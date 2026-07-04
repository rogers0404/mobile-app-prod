"""
Trip Ride-Share Backend API
Complete backend for rider/driver ride-share application
No authentication required - simple user ID based system
"""

from fastapi import FastAPI, HTTPException, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
import os
import uuid
import httpx
import math
import json
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

# PayPal Configuration
PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID", "Aa4nbnwrjDoXu8sMByKts9p2ulJ-YhB815CrJl6Pw5Vt0vqlcNi6RANSHHkVvnhU7A2W5Xv3XthtSJPs")
PAYPAL_SECRET = os.getenv("PAYPAL_SECRET", "EMHV6aFm93J62O4wcsomipykrROQuVdo64dl_f6XUEtXYnMfM7oGdok8_iQEkYxT8aFpGNUsgrNWaFaL")
PAYPAL_BASE_URL = "https://api-m.sandbox.paypal.com"

# MongoDB Configuration
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "test_database")

app = FastAPI(title="Trip Ride-Share API")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB Client
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Pricing Configuration
BASE_FARE = 2.00  # $2 base fare
PER_MILE_RATE = 1.50  # $1.50 per mile

# WebSocket connections for real-time updates
active_connections: Dict[str, WebSocket] = {}

# In-memory fallback store for local development when MongoDB is unavailable
in_memory_users: Dict[str, Dict[str, Any]] = {}
in_memory_driver_status: Dict[str, Dict[str, Any]] = {}
in_memory_driver_documents: Dict[str, Dict[str, Any]] = {}

# =========================
# Pydantic Models
# =========================

class CreateUserRequest(BaseModel):
    user_type: str  # 'rider' or 'driver'
    name: Optional[str] = "Trip User"

class DriverDocument(BaseModel):
    document_type: str  # 'license' or 'insurance'
    document_data: str  # base64 encoded
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DriverDocumentUpload(BaseModel):
    user_id: str
    license_data: Optional[str] = None  # base64 encoded
    insurance_data: Optional[str] = None  # base64 encoded
    vehicle_make: str
    vehicle_model: str
    vehicle_year: str
    vehicle_color: str
    license_plate: str

class DriverLocation(BaseModel):
    user_id: str
    latitude: float
    longitude: float

class DriverStatusUpdate(BaseModel):
    user_id: str
    is_online: bool

class RideRequest(BaseModel):
    user_id: str
    pickup_latitude: float
    pickup_longitude: float
    pickup_address: str
    dropoff_latitude: float
    dropoff_longitude: float
    dropoff_address: str

class AcceptRideRequest(BaseModel):
    user_id: str
    ride_id: str

class UpdateRideStatusRequest(BaseModel):
    user_id: str
    ride_id: str
    status: str  # 'picked_up', 'completed', 'cancelled'

class RideRatingRequest(BaseModel):
    user_id: str
    ride_id: str
    rating: int  # 1-5
    comment: Optional[str] = None

# =========================
# Helper Functions
# =========================

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points using Haversine formula (in miles)"""
    R = 3959  # Earth's radius in miles
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

def calculate_fare(distance_miles: float) -> float:
    """Calculate fare based on distance"""
    return round(BASE_FARE + (PER_MILE_RATE * distance_miles), 2)

def serialize_ride(ride: dict) -> dict:
    """Convert datetime fields to ISO strings for JSON serialization"""
    return {
        k: v.isoformat() if isinstance(v, datetime) else v
        for k, v in ride.items()
    }

async def get_paypal_access_token() -> str:
    """Get PayPal access token"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{PAYPAL_BASE_URL}/v1/oauth2/token",
            auth=(PAYPAL_CLIENT_ID, PAYPAL_SECRET),
            data={"grant_type": "client_credentials"},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to get PayPal access token")
        return response.json()["access_token"]

async def save_user(user_data: dict) -> bool:
    """Persist a user to MongoDB when available, otherwise fall back to memory."""
    try:
        await db.users.insert_one(user_data)
        return True
    except Exception:
        in_memory_users[user_data["user_id"]] = dict(user_data)
        return False


async def save_driver_status(status_data: dict) -> bool:
    """Persist driver status to MongoDB when available, otherwise fall back to memory."""
    try:
        await db.driver_status.insert_one(status_data)
        return True
    except Exception:
        in_memory_driver_status[status_data["user_id"]] = dict(status_data)
        return False


async def get_user(user_id: str) -> dict:
    """Get user by ID"""
    try:
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    except Exception:
        user = in_memory_users.get(user_id)

    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


async def broadcast_to_drivers(message: dict):
    """Broadcast message to all online drivers"""
    online_drivers = await db.driver_status.find({"is_online": True}, {"_id": 0}).to_list(100)
    for driver in online_drivers:
        driver_id = driver.get("user_id")
        if driver_id in active_connections:
            try:
                await active_connections[driver_id].send_json(message)
            except:
                pass

# =========================
# Health Check
# =========================

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# =========================
# User Endpoints (No Auth)
# =========================

@app.post("/api/users/create")
async def create_user(data: CreateUserRequest):
    """Create a new user (rider or driver)"""
    if data.user_type not in ['rider', 'driver']:
        raise HTTPException(status_code=400, detail="Invalid user type. Must be 'rider' or 'driver'")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    
    new_user = {
        "user_id": user_id,
        "name": data.name,
        "user_type": data.user_type,
        "created_at": datetime.now(timezone.utc)
    }
    
    await save_user(new_user)
    
    # If driver, initialize driver status
    if data.user_type == 'driver':
        await save_driver_status({
            "user_id": user_id,
            "is_online": False,
            "is_verified": False,
            "created_at": datetime.now(timezone.utc)
        })
    
    new_user.pop("_id", None)
    return new_user

@app.get("/api/users/{user_id}")
async def get_user_profile(user_id: str):
    """Get user profile"""
    user = await get_user(user_id)
    
    response_data = {**user}
    
    if user.get("user_type") == "driver":
        # Get driver status
        try:
            driver_status = await db.driver_status.find_one({"user_id": user_id}, {"_id": 0})
        except Exception:
            driver_status = in_memory_driver_status.get(user_id)
        response_data["driver_status"] = driver_status
        
        # Get documents
        try:
            documents = await db.driver_documents.find_one({"user_id": user_id}, {"_id": 0})
        except Exception:
            documents = in_memory_driver_documents.get(user_id)
        response_data["documents"] = documents
    
    # Get ride stats
    try:
        if user.get("user_type") == "rider":
            ride_count = await db.rides.count_documents({"rider_id": user_id})
        else:
            ride_count = await db.rides.count_documents({"driver_id": user_id})
    except Exception:
        ride_count = 0
    
    response_data["total_rides"] = ride_count
    
    return response_data

class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

@app.put("/api/users/{user_id}")
async def update_user_profile(user_id: str, data: UpdateUserRequest):
    """Update user profile"""
    user = await get_user(user_id)
    
    updates = {}
    if data.name is not None:
        updates["name"] = data.name
    if data.phone is not None:
        updates["phone"] = data.phone
    if data.email is not None:
        updates["email"] = data.email
    
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    updates["updated_at"] = datetime.now(timezone.utc)
    await db.users.update_one({"user_id": user_id}, {"$set": updates})
    
    updated_user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return updated_user

@app.delete("/api/users/{user_id}")
async def delete_user_account(user_id: str):
    """Delete user account and all associated data"""
    user = await get_user(user_id)
    
    # Check for active rides
    active_ride = await db.rides.find_one({
        "$or": [{"rider_id": user_id}, {"driver_id": user_id}],
        "status": {"$in": ["pending", "accepted", "picked_up"]}
    })
    if active_ride:
        raise HTTPException(status_code=400, detail="Cannot delete account with an active ride. Please complete or cancel your ride first.")
    
    # Delete user data
    await db.users.delete_one({"user_id": user_id})
    
    if user.get("user_type") == "driver":
        await db.driver_status.delete_one({"user_id": user_id})
        await db.driver_documents.delete_one({"user_id": user_id})
        await db.driver_locations.delete_one({"user_id": user_id})
    
    return {"message": "Account deleted successfully"}


@app.get("/api/driver/{user_id}/earnings")
async def get_driver_earnings(user_id: str):
    """Get driver earnings breakdown"""
    user = await get_user(user_id)
    if user.get("user_type") != "driver":
        raise HTTPException(status_code=403, detail="Not a driver")
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = today_start.replace(day=1)
    
    completed_rides = await db.rides.find(
        {"driver_id": user_id, "status": "completed"},
        {"_id": 0}
    ).sort("completed_at", -1).to_list(length=500)
    
    def parse_ts(val):
        if val is None:
            return None
        if isinstance(val, datetime):
            return val.replace(tzinfo=timezone.utc) if val.tzinfo is None else val
        if isinstance(val, str):
            try:
                dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
                return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
            except:
                return None
        return None
    
    total_earnings = sum(r.get("fare", 0) for r in completed_rides)
    total_rides = len(completed_rides)
    
    today_rides = [r for r in completed_rides if (ts := parse_ts(r.get("completed_at"))) and ts >= today_start]
    today_earnings = sum(r.get("fare", 0) for r in today_rides)
    
    week_rides = [r for r in completed_rides if (ts := parse_ts(r.get("completed_at"))) and ts >= week_start]
    week_earnings = sum(r.get("fare", 0) for r in week_rides)
    
    month_rides = [r for r in completed_rides if (ts := parse_ts(r.get("completed_at"))) and ts >= month_start]
    month_earnings = sum(r.get("fare", 0) for r in month_rides)
    
    daily_earnings = []
    for i in range(6, -1, -1):
        day_start = today_start - timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        day_rides = [r for r in completed_rides if (ts := parse_ts(r.get("completed_at"))) and day_start <= ts < day_end]
        daily_earnings.append({
            "date": day_start.strftime("%a"),
            "amount": round(sum(r.get("fare", 0) for r in day_rides), 2),
            "rides": len(day_rides),
        })
    
    recent = []
    for r in completed_rides[:10]:
        ts = r.get("completed_at", r.get("created_at", ""))
        recent.append({
            "ride_id": r["ride_id"],
            "pickup_address": r.get("pickup_address", ""),
            "dropoff_address": r.get("dropoff_address", ""),
            "fare": r.get("fare", 0),
            "completed_at": ts.isoformat() if isinstance(ts, datetime) else str(ts),
        })
    
    return {
        "total_earnings": round(total_earnings, 2),
        "total_rides": total_rides,
        "today": {"earnings": round(today_earnings, 2), "rides": len(today_rides)},
        "this_week": {"earnings": round(week_earnings, 2), "rides": len(week_rides)},
        "this_month": {"earnings": round(month_earnings, 2), "rides": len(month_rides)},
        "daily_chart": daily_earnings,
        "recent_rides": recent,
    }




# =========================
# Driver Endpoints
# =========================

@app.post("/api/driver/documents")
async def upload_documents(data: DriverDocumentUpload):
    """Upload driver verification documents"""
    user = await get_user(data.user_id)
    
    if user.get("user_type") != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can upload documents")
    
    document_data = {
        "user_id": data.user_id,
        "license_data": data.license_data,
        "insurance_data": data.insurance_data,
        "vehicle_make": data.vehicle_make,
        "vehicle_model": data.vehicle_model,
        "vehicle_year": data.vehicle_year,
        "vehicle_color": data.vehicle_color,
        "license_plate": data.license_plate,
        "uploaded_at": datetime.now(timezone.utc),
        "verified": False
    }

    try:
        await db.driver_documents.update_one(
            {"user_id": data.user_id},
            {"$set": document_data},
            upsert=True
        )
    except Exception:
        in_memory_driver_documents[data.user_id] = dict(document_data)

    try:
        await db.driver_status.update_one(
            {"user_id": data.user_id},
            {"$set": {"is_verified": True, "updated_at": datetime.now(timezone.utc)}}
        )
    except Exception:
        in_memory_driver_status[data.user_id] = {
            "user_id": data.user_id,
            "is_online": False,
            "is_verified": True,
            "updated_at": datetime.now(timezone.utc),
        }
    
    return {"message": "Documents uploaded successfully", "verified": True}

@app.get("/api/driver/{user_id}/documents")
async def get_documents(user_id: str):
    """Get driver documents"""
    user = await get_user(user_id)
    
    if user.get("user_type") != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can view documents")
    
    documents = await db.driver_documents.find_one({"user_id": user_id}, {"_id": 0})
    return documents or {}

@app.post("/api/driver/location")
async def update_location(data: DriverLocation):
    """Update driver location"""
    user = await get_user(data.user_id)
    
    if user.get("user_type") != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can update location")
    
    await db.driver_locations.update_one(
        {"user_id": data.user_id},
        {"$set": {
            "user_id": data.user_id,
            "latitude": data.latitude,
            "longitude": data.longitude,
            "updated_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )
    
    return {"message": "Location updated"}

@app.post("/api/driver/status")
async def update_driver_status(data: DriverStatusUpdate):
    """Update driver online status"""
    user = await get_user(data.user_id)
    
    if user.get("user_type") != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can update status")
    
    # Check if driver is verified
    driver_status = await db.driver_status.find_one({"user_id": data.user_id}, {"_id": 0})
    if not driver_status or not driver_status.get("is_verified"):
        raise HTTPException(status_code=403, detail="Driver not verified. Please upload documents first.")
    
    await db.driver_status.update_one(
        {"user_id": data.user_id},
        {"$set": {"is_online": data.is_online, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Status updated", "is_online": data.is_online}

@app.get("/api/driver/{user_id}/status")
async def get_driver_status(user_id: str):
    """Get driver status"""
    user = await get_user(user_id)
    
    if user.get("user_type") != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can view status")
    
    status = await db.driver_status.find_one({"user_id": user_id}, {"_id": 0})
    return status or {"is_online": False, "is_verified": False}

@app.get("/api/driver/{user_id}/pending-rides")
async def get_pending_rides(user_id: str):
    """Get pending ride requests for drivers"""
    user = await get_user(user_id)
    
    if user.get("user_type") != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can view pending rides")
    
    # Get pending rides
    rides = await db.rides.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    
    return rides

@app.get("/api/driver/{user_id}/active-ride")
async def get_driver_active_ride(user_id: str):
    """Get driver's current active ride"""
    user = await get_user(user_id)
    
    if user.get("user_type") != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can view active ride")
    
    ride = await db.rides.find_one(
        {
            "driver_id": user_id,
            "status": {"$in": ["accepted", "picked_up"]}
        },
        {"_id": 0}
    )
    
    return ride

# =========================
# Rider Endpoints
# =========================

@app.get("/api/rider/nearby-drivers")
async def get_nearby_drivers(latitude: float, longitude: float, radius: float = 10):
    """Get nearby online drivers"""
    # Get all online drivers
    online_drivers = await db.driver_status.find(
        {"is_online": True, "is_verified": True},
        {"_id": 0}
    ).to_list(100)
    
    nearby_drivers = []
    
    for driver in online_drivers:
        # Get driver location
        location = await db.driver_locations.find_one(
            {"user_id": driver["user_id"]},
            {"_id": 0}
        )
        
        if location:
            distance = calculate_distance(
                latitude, longitude,
                location["latitude"], location["longitude"]
            )
            
            if distance <= radius:
                # Get driver info
                driver_info = await db.users.find_one(
                    {"user_id": driver["user_id"]},
                    {"_id": 0}
                )
                
                # Get vehicle info
                vehicle = await db.driver_documents.find_one(
                    {"user_id": driver["user_id"]},
                    {"_id": 0, "license_data": 0, "insurance_data": 0}
                )
                
                nearby_drivers.append({
                    "user_id": driver["user_id"],
                    "name": driver_info.get("name") if driver_info else "Driver",
                    "latitude": location["latitude"],
                    "longitude": location["longitude"],
                    "distance": round(distance, 2),
                    "vehicle": vehicle
                })
    
    return nearby_drivers

@app.post("/api/rides/request")
async def request_ride(data: RideRequest):
    """Request a new ride"""
    user = await get_user(data.user_id)
    
    if user.get("user_type") != "rider":
        raise HTTPException(status_code=403, detail="Only riders can request rides")
    
    try:
        existing_ride = await db.rides.find_one({
            "rider_id": data.user_id,
            "status": {"$in": ["pending", "accepted", "picked_up"]}
        })
    except Exception:
        existing_ride = None
    
    if existing_ride:
        raise HTTPException(status_code=400, detail="You already have an active ride")
    
    distance = calculate_distance(
        data.pickup_latitude, data.pickup_longitude,
        data.dropoff_latitude, data.dropoff_longitude
    )
    fare = calculate_fare(distance)
    
    ride_id = f"ride_{uuid.uuid4().hex[:12]}"
    
    ride = {
        "ride_id": ride_id,
        "rider_id": data.user_id,
        "rider_name": user.get("name"),
        "driver_id": None,
        "driver_name": None,
        "pickup_latitude": data.pickup_latitude,
        "pickup_longitude": data.pickup_longitude,
        "pickup_address": data.pickup_address,
        "dropoff_latitude": data.dropoff_latitude,
        "dropoff_longitude": data.dropoff_longitude,
        "dropoff_address": data.dropoff_address,
        "distance_miles": round(distance, 2),
        "fare": fare,
        "status": "pending",
        "payment_status": "unpaid",
        "created_at": datetime.now(timezone.utc),
        "accepted_at": None,
        "picked_up_at": None,
        "completed_at": None
    }
    
    try:
        await db.rides.insert_one(ride)
    except Exception:
        pass
    
    ride.pop("_id", None)
    
    return serialize_ride(ride)

@app.post("/api/rides/accept")
async def accept_ride(data: AcceptRideRequest):
    """Accept a ride request (driver only)"""
    user = await get_user(data.user_id)
    
    if user.get("user_type") != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can accept rides")
    
    # Check if driver is online and verified
    driver_status = await db.driver_status.find_one({"user_id": data.user_id}, {"_id": 0})
    if not driver_status or not driver_status.get("is_online"):
        raise HTTPException(status_code=403, detail="You must be online to accept rides")
    if not driver_status.get("is_verified"):
        raise HTTPException(status_code=403, detail="You must be verified to accept rides")
    
    # Check if driver already has an active ride
    existing_ride = await db.rides.find_one({
        "driver_id": data.user_id,
        "status": {"$in": ["accepted", "picked_up"]}
    })
    
    if existing_ride:
        raise HTTPException(status_code=400, detail="You already have an active ride")
    
    # Find and update the ride
    ride = await db.rides.find_one({"ride_id": data.ride_id, "status": "pending"})
    
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found or already accepted")
    
    # Get vehicle info
    vehicle = await db.driver_documents.find_one(
        {"user_id": data.user_id},
        {"_id": 0, "license_data": 0, "insurance_data": 0}
    )
    
    await db.rides.update_one(
        {"ride_id": data.ride_id},
        {"$set": {
            "driver_id": data.user_id,
            "driver_name": user.get("name"),
            "driver_vehicle": vehicle,
            "status": "accepted",
            "accepted_at": datetime.now(timezone.utc)
        }}
    )
    
    updated_ride = await db.rides.find_one({"ride_id": data.ride_id}, {"_id": 0})
    return serialize_ride(updated_ride) if updated_ride else updated_ride

@app.post("/api/rides/update-status")
async def update_ride_status(data: UpdateRideStatusRequest):
    """Update ride status"""
    user = await get_user(data.user_id)
    
    ride = await db.rides.find_one({"ride_id": data.ride_id})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    # Verify user is part of the ride
    if data.user_id not in [ride.get("driver_id"), ride.get("rider_id")]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    valid_transitions = {
        "accepted": ["picked_up", "cancelled"],
        "picked_up": ["completed", "cancelled"],
        "pending": ["cancelled"]
    }
    
    current_status = ride["status"]
    if data.status not in valid_transitions.get(current_status, []):
        raise HTTPException(status_code=400, detail=f"Cannot change status from {current_status} to {data.status}")
    
    update_data = {"status": data.status}
    
    if data.status == "picked_up":
        update_data["picked_up_at"] = datetime.now(timezone.utc)
    elif data.status == "completed":
        update_data["completed_at"] = datetime.now(timezone.utc)
    elif data.status == "cancelled":
        update_data["cancelled_at"] = datetime.now(timezone.utc)
    
    await db.rides.update_one(
        {"ride_id": data.ride_id},
        {"$set": update_data}
    )
    
    updated_ride = await db.rides.find_one({"ride_id": data.ride_id}, {"_id": 0})
    return serialize_ride(updated_ride) if updated_ride else updated_ride

@app.get("/api/rides/{user_id}/active")
async def get_active_ride(user_id: str):
    """Get user's current active ride"""
    user = await get_user(user_id)
    
    if user.get("user_type") == "rider":
        ride = await db.rides.find_one(
            {
                "rider_id": user_id,
                "status": {"$in": ["pending", "accepted", "picked_up"]}
            },
            {"_id": 0}
        )
    else:
        ride = await db.rides.find_one(
            {
                "driver_id": user_id,
                "status": {"$in": ["accepted", "picked_up"]}
            },
            {"_id": 0}
        )
    
    return ride

@app.get("/api/rides/{user_id}/history")
async def get_ride_history(
    user_id: str,
    search: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = 50
):
    """Get user's ride history with optional filters"""
    user = await get_user(user_id)
    
    if user.get("user_type") == "rider":
        query = {"rider_id": user_id}
    else:
        query = {"driver_id": user_id}
    
    # Status filter
    if status and status != "all":
        query["status"] = status
    
    # Date range filter
    if date_from:
        try:
            from_date = datetime.fromisoformat(date_from.replace("Z", "+00:00"))
            query["created_at"] = {"$gte": from_date}
        except:
            pass
    
    if date_to:
        try:
            to_date = datetime.fromisoformat(date_to.replace("Z", "+00:00"))
            if "created_at" in query:
                query["created_at"]["$lte"] = to_date
            else:
                query["created_at"] = {"$lte": to_date}
        except:
            pass
    
    # Search filter (search in addresses)
    if search and search.strip():
        search_regex = {"$regex": search.strip(), "$options": "i"}
        query["$or"] = [
            {"pickup_address": search_regex},
            {"dropoff_address": search_regex},
            {"rider_name": search_regex},
            {"driver_name": search_regex}
        ]
    
    rides = await db.rides.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return rides

@app.get("/api/rides/details/{ride_id}")
async def get_ride(ride_id: str, user_id: str):
    """Get specific ride details"""
    user = await get_user(user_id)
    
    ride = await db.rides.find_one({"ride_id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    # Verify user is part of the ride
    if user_id not in [ride.get("driver_id"), ride.get("rider_id")]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get driver location if ride is active
    if ride["status"] in ["accepted", "picked_up"] and ride.get("driver_id"):
        driver_location = await db.driver_locations.find_one(
            {"user_id": ride["driver_id"]},
            {"_id": 0}
        )
        if driver_location:
            ride["driver_location"] = {
                "latitude": driver_location["latitude"],
                "longitude": driver_location["longitude"]
            }
    
    return serialize_ride(ride) if ride else ride

@app.post("/api/rides/rate")
async def rate_ride(data: RideRatingRequest):
    """Rate a completed ride"""
    user = await get_user(data.user_id)
    
    ride = await db.rides.find_one({"ride_id": data.ride_id})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    if ride["status"] != "completed":
        raise HTTPException(status_code=400, detail="Can only rate completed rides")
    
    # Verify user is part of the ride
    if data.user_id not in [ride.get("driver_id"), ride.get("rider_id")]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if data.rating < 1 or data.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    # Save rating
    rating_field = "rider_rating" if user.get("user_type") == "rider" else "driver_rating"
    
    await db.rides.update_one(
        {"ride_id": data.ride_id},
        {"$set": {rating_field: data.rating, f"{rating_field}_comment": data.comment}}
    )
    
    return {"message": "Rating submitted"}

# =========================
# Payment Endpoints
# =========================

@app.post("/api/payment/create-order")
async def create_payment_order(ride_id: str, user_id: str):
    """Create PayPal order for ride payment"""
    user = await get_user(user_id)
    
    ride = await db.rides.find_one({"ride_id": ride_id})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    if ride["rider_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if ride["payment_status"] == "paid":
        raise HTTPException(status_code=400, detail="Ride already paid")
    
    try:
        access_token = await get_paypal_access_token()
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{PAYPAL_BASE_URL}/v2/checkout/orders",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                },
                json={
                    "intent": "CAPTURE",
                    "purchase_units": [{
                        "reference_id": ride_id,
                        "description": f"Trip ride from {ride['pickup_address']} to {ride['dropoff_address']}",
                        "amount": {
                            "currency_code": "USD",
                            "value": str(ride["fare"])
                        }
                    }]
                }
            )
            
            if response.status_code != 201:
                raise HTTPException(status_code=500, detail="Failed to create PayPal order")
            
            order_data = response.json()
            
            # Save order ID to ride
            await db.rides.update_one(
                {"ride_id": ride_id},
                {"$set": {"paypal_order_id": order_data["id"]}}
            )
            
            return order_data
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/payment/capture-order")
async def capture_payment_order(order_id: str, user_id: str):
    """Capture PayPal payment"""
    user = await get_user(user_id)
    
    try:
        access_token = await get_paypal_access_token()
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{PAYPAL_BASE_URL}/v2/checkout/orders/{order_id}/capture",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code != 201:
                raise HTTPException(status_code=500, detail="Failed to capture payment")
            
            capture_data = response.json()
            
            # Update ride payment status
            if capture_data["status"] == "COMPLETED":
                await db.rides.update_one(
                    {"paypal_order_id": order_id},
                    {"$set": {
                        "payment_status": "paid",
                        "payment_completed_at": datetime.now(timezone.utc)
                    }}
                )
            
            return capture_data
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =========================
# Google Places Proxy (avoids CORS)
# =========================

GOOGLE_MAPS_API_KEY = "AIzaSyDcACq481PilZRSUgFvy6yQBjnRgzKkQqg"

@app.get("/api/places/search")
async def search_places(query: str, latitude: float = 0, longitude: float = 0):
    """Proxy for Google Places Autocomplete API"""
    try:
        params = {
            "input": query,
            "key": GOOGLE_MAPS_API_KEY,
            "types": "geocode|establishment",
        }
        if latitude and longitude:
            params["location"] = f"{latitude},{longitude}"
            params["radius"] = "50000"

        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://maps.googleapis.com/maps/api/place/autocomplete/json",
                params=params
            )
            data = response.json()
            return data.get("predictions", [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/places/details")
async def get_place_details(place_id: str):
    """Proxy for Google Places Details API"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://maps.googleapis.com/maps/api/place/details/json",
                params={
                    "place_id": place_id,
                    "key": GOOGLE_MAPS_API_KEY,
                    "fields": "geometry,formatted_address,name"
                }
            )
            data = response.json()
            if data.get("result"):
                result = data["result"]
                return {
                    "lat": result["geometry"]["location"]["lat"],
                    "lng": result["geometry"]["location"]["lng"],
                    "address": result.get("formatted_address", ""),
                    "name": result.get("name", ""),
                }
            raise HTTPException(status_code=404, detail="Place not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/directions")
async def get_directions(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float
):
    """Proxy for Google Directions API - provides turn-by-turn navigation"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://maps.googleapis.com/maps/api/directions/json",
                params={
                    "origin": f"{origin_lat},{origin_lng}",
                    "destination": f"{dest_lat},{dest_lng}",
                    "key": GOOGLE_MAPS_API_KEY,
                    "mode": "driving"
                }
            )
            data = response.json()
            
            if data.get("status") == "OK" and data.get("routes"):
                route = data["routes"][0]
                leg = route["legs"][0]
                
                steps = []
                for step in leg.get("steps", []):
                    # Strip HTML tags from instructions
                    import re
                    instruction = re.sub(r'<[^>]*>', '', step.get("html_instructions", ""))
                    steps.append({
                        "instruction": instruction,
                        "distance": step.get("distance", {}).get("text", ""),
                        "duration": step.get("duration", {}).get("text", ""),
                        "maneuver": step.get("maneuver", ""),
                        "start_location": step.get("start_location", {}),
                        "end_location": step.get("end_location", {})
                    })
                
                return {
                    "status": "OK",
                    "duration": leg.get("duration", {}).get("text", ""),
                    "duration_value": leg.get("duration", {}).get("value", 0),
                    "distance": leg.get("distance", {}).get("text", ""),
                    "distance_value": leg.get("distance", {}).get("value", 0),
                    "start_address": leg.get("start_address", ""),
                    "end_address": leg.get("end_address", ""),
                    "steps": steps,
                    "overview_polyline": route.get("overview_polyline", {}).get("points", "")
                }
            
            return {"status": data.get("status", "ERROR"), "error": "No routes found"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# =========================
# WebSocket for Real-time Updates
# =========================

@app.websocket("/api/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    """WebSocket connection for real-time updates"""
    await websocket.accept()
    active_connections[user_id] = websocket
    
    try:
        while True:
            data = await websocket.receive_json()
            
            # Handle location updates from drivers
            if data.get("type") == "location_update":
                await db.driver_locations.update_one(
                    {"user_id": user_id},
                    {"$set": {
                        "user_id": user_id,
                        "latitude": data["latitude"],
                        "longitude": data["longitude"],
                        "updated_at": datetime.now(timezone.utc)
                    }},
                    upsert=True
                )
                
                # If driver has an active ride, notify the rider
                active_ride = await db.rides.find_one({
                    "driver_id": user_id,
                    "status": {"$in": ["accepted", "picked_up"]}
                })
                
                if active_ride and active_ride["rider_id"] in active_connections:
                    try:
                        await active_connections[active_ride["rider_id"]].send_json({
                            "type": "driver_location",
                            "latitude": data["latitude"],
                            "longitude": data["longitude"]
                        })
                    except:
                        pass
            
            # Handle ride status updates
            elif data.get("type") == "ride_update":
                ride_id = data.get("ride_id")
                ride = await db.rides.find_one({"ride_id": ride_id}, {"_id": 0})
                
                if ride:
                    # Notify the other party
                    other_user = ride["driver_id"] if ride["rider_id"] == user_id else ride["rider_id"]
                    if other_user and other_user in active_connections:
                        try:
                            await active_connections[other_user].send_json({
                                "type": "ride_update",
                                "ride": ride
                            })
                        except:
                            pass
                            
    except WebSocketDisconnect:
        active_connections.pop(user_id, None)
    except Exception as e:
        active_connections.pop(user_id, None)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
