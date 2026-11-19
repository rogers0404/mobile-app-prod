# Cost Analysis & Budget Planning

## Monthly Cost Breakdown

### Best Case Scenario (Startup - 100 rides/day)
```
API Gateway:        $2.00   (100K requests @ $3.50/M)
Lambda:             $0.50   (Included in free tier)
DynamoDB:           $1.00   (On-demand, low volume)
Cognito:            $0.00   (Free tier: 50K users)
S3:                 $0.50   (Document storage)
CloudWatch:         $0.00   (Free tier included)
SQS/SNS:            $0.10   (Minimal events)
Data Transfer:      $0.00   (AWS free tier)
─────────────────────────────
TOTAL:              $4.10/month

Annual: ~$49
```

### Growth Scenario (1,000 rides/day)
```
API Gateway:        $20.00  (1M requests @ $3.50/M)
Lambda:             $5.00   (Compute costs)
DynamoDB:           $5.00   (On-demand, 1-5K reads/sec)
Cognito:            $0.00   (Free tier)
S3:                 $1.00   (Documents, images)
CloudWatch:         $0.00   (Free tier)
SQS/SNS:            $0.50   (Event processing)
Data Transfer:      $1.00   (Minimal egress)
─────────────────────────────
TOTAL:              $32.50/month

Annual: ~$390
```

### Enterprise Scenario (10,000 rides/day)
```
API Gateway:        $200.00 (10M requests)
Lambda:             $50.00  (Higher compute load)
DynamoDB:           $50.00  (10-50K reads/sec, consider reserved)
Cognito:            $0.00   (Free tier)
S3:                 $5.00   (More documents)
CloudWatch:         $10.00  (Advanced monitoring)
SQS/SNS:            $5.00   (Event processing)
Data Transfer:      $20.00  (More egress)
─────────────────────────────
TOTAL:              $340/month

Annual: ~$4,080
(Could reduce to ~$2,500 with reserved capacity)
```

## Service-by-Service Pricing Details

### 1. API Gateway

**Pricing Model**:
- **REST API**: $3.50 per million requests
- **WebSocket**: $0.25 per million messages
- **Data Transfer Out**: $0.09 per GB

**Example Costs**:
| Requests/Month | Cost |
|---|---|
| 1 million | $3.50 |
| 10 million | $35.00 |
| 100 million | $350.00 |

**Cost Optimization**:
```
1. Enable caching for GET endpoints
   - Reduces Lambda invocations
   - Cache TTL: 5-60 minutes depending on endpoint
   
2. Use request/response mapping
   - Combine multiple calls into one
   
3. Set CloudFront in front
   - Caches responses
   - Reduces API calls by 40-60%
   - Cost: $0.085/GB transferred
```

**Example**: With caching enabled on ride tracking
- Without caching: 1,000 requests → $3.50
- With caching: 1,000 requests → 100 unique → $0.35 (90% savings!)

### 2. AWS Lambda

**Pricing Model**:
- **Free Tier**: 1 million requests + 400,000 GB-seconds per month
- **Paid**: $0.20 per 1 million requests + $0.0000166667 per GB-second

**Cost Calculation**:
```
Cost = (Requests × $0.20/1M) + (Duration × Memory × $0.0000166667)

Example: 100,000 requests, 512MB memory, 1 second average
  Request Cost:   (100,000 ÷ 1,000,000) × $0.20 = $0.02
  Duration Cost:  (100,000 × 512MB × 1s) × $0.0000166667 = $0.85
  Total:          ~$0.87/month (covered by free tier)
```

**Memory Optimization**:
| Memory | vCPU | Cost per 1M requests |
|---|---|---|
| 128 MB | 0.083 | $0.21 |
| 256 MB | 0.167 | $0.42 |
| 512 MB | 0.333 | $0.84 |
| 1024 MB | 0.667 | $1.67 |
| 3008 MB | 2.0 | $5.01 |

**Recommendation**: Use 512MB for most functions (good balance of speed & cost)

**Cost Optimization**:
```
1. Increase memory for I/O-heavy functions
   - 512MB → 1024MB (2x faster)
   - Duration: 2 seconds → 1 second
   - Total cost savings: 20%

2. Use Lambda Layers for common dependencies
   - Reduces cold start time
   - Improves performance

3. Enable Lambda Insights
   - Better monitoring
   - Identify optimization opportunities
   
4. Reserve Concurrency (Advanced)
   - $0.015 per GB-hour reserved
   - Saves 50% if confident in baseline load
```

### 3. DynamoDB

**On-Demand Pricing**:
```
Read Capacity:  $1.25 per million RCU
Write Capacity: $6.25 per million WCU

Typical Ride App Usage:
- Creating ride: 1 write + 1 GSI write ≈ 2 WCU
- Fetching ride: 1 read ≈ 1 RCU
- Tracking location: 1 write ≈ 1 WCU

Example: 1,000 rides/day
- Writes: 1,000 rides × 2 = 2,000 WCU/day
- Reads: 1,000 rides × 10 user queries = 10,000 RCU/day
- Monthly: 60,000 WCU + 300,000 RCU
- Cost: (60K × $6.25/M) + (300K × $1.25/M) = $0.56/month
```

**Provisioned Capacity** (Recommended at scale):
```
Example: 10,000 rides/day
On-Demand Cost:  $5-10/month
Reserved (100 WCU, 500 RCU): $60/month
Break-even: ~20,000 rides/day

Reserved Capacity Benefits:
- Save 50-70% vs on-demand
- Guaranteed performance
- Minimum 1-year commitment required
```

**Cost Optimization**:
```
1. Use Global Secondary Indexes sparingly
   - Each GSI consumes RCU/WCU
   - Design queries to avoid GSI when possible

2. Implement TTL for temporary data
   - ride_locations (1 day TTL)
   - Automatic deletion, free!

3. Use DynamoDB Streams + Lambda
   - Process changes asynchronously
   - Reduce direct API calls

4. Query Optimization
   - Use partition keys efficiently
   - Avoid full table scans
   - Use projection expressions

5. Compression
   - Store JSON as compressed string
   - Reduce storage size by 30-50%
```

### 4. Amazon S3

**Pricing Model**:
```
Storage:            $0.023 per GB/month
API Requests:       
  - PUT/COPY/POST:  $0.005 per 1,000 requests
  - GET/SELECT:     $0.0004 per 1,000 requests
  - DELETE:         Free

Data Transfer:
  - Out (to internet): $0.09 per GB
  - Between AWS:       Free
  - Into AWS:          Free
```

**Example**: 10,000 driver documents (average 2MB each)
```
Storage: 10,000 docs × 2MB = 20GB = $0.46/month
Uploads: 10,000 uploads = $0.05/month
Downloads: 50,000 views = $0.02/month
Transfer out: 20GB × $0.09 = $1.80/month
─────────────────────────────
Total: ~$2.33/month
```

**Cost Optimization**:
```
1. Use S3 Lifecycle Policies
   - Move to Glacier after 90 days (saves 90%)
   - Delete after 1 year

2. Enable Intelligent-Tiering
   - Automatically moves between access tiers
   - No retrieval fees

3. Use Cloudfront for downloads
   - Caching reduces S3 requests
   - Lower data transfer costs

4. Compress files
   - JPEG for photos (instead of PNG)
   - Store PDFs compressed
   - Reduces storage by 50-70%
```

### 5. Amazon Cognito

**Pricing Model**:
```
Free Tier:
- Up to 50,000 Monthly Active Users (MAUs)
- Unlimited user sign-ups and sign-ins
- Free identity federation

Paid (after 50K MAUs):
- $0.015 per MAU per month
- Simple cost model
```

**Example**: 100K active riders
```
Free tier: First 50K = $0.00
Paid tier: Next 50K × $0.015 = $0.75/month

Annual: ~$9/year for 100K users!
```

**No additional costs for**:
- MFA (SMS, TOTP)
- Advanced security features
- Cross-platform authentication

### 6. CloudWatch Logs

**Pricing Model**:
```
Ingestion:    $0.50 per GB
Storage:      $0.03 per GB-month
Queries:      $0.005 per MB scanned (Logs Insights)

Free Tier:
- 5 GB ingestion
- 5 GB storage for 7 days
```

**Example**: Lambda logging 1 request every 10 seconds
```
Avg log size: 2 KB/request
Daily logs: 8,640 requests × 2KB = 17.3 MB
Monthly: 520 MB = Within free tier!
```

**Cost Optimization**:
```
1. Set log retention (not forever)
   - 7 days: $0.00 (free tier)
   - 30 days: $0.00 (free tier)
   - 90 days: $1.50/month

2. Filter logs before ingestion
   - Don't log sensitive data anyway
   - Reduces cost 20-30%

3. Use structured logging
   - JSON format
   - Query more efficiently

4. Sample logs in production
   - Log 10% instead of 100%
   - Reduce ingestion 90%
```

### 7. SQS & SNS

**SQS Pricing**:
```
Standard Queue:
- First 1 million requests: Free
- Next requests: $0.40 per million

FIFO Queue:
- First 300K requests: Free
- Next requests: $0.50 per million

Payload size: First 256KB free
Over 256KB: $0.40 per million requests
```

**SNS Pricing**:
```
Publish to Topic:   $0.50 per million
SMS Notification:   $0.00645 per SMS (variable by country)
Email Notification: First 1,000 free, then $2.00 per 100K
Push Notifications: $1.00 per million
```

**Example**: 1,000 rides/day with notifications
```
SQS Publish:   1,000 rides/day = 30K/month = Free tier
SNS Publish:   1,000 × 2 = 2,000/day = 60K/month ≈ $0.03/month
SMS to Driver: 1,000 SMS/day = 30K/month = $193/month ⚠️

Cost Optimization:
1. Use in-app notifications instead of SMS
   - Completely free (use API Gateway WebSocket)
   
2. Only send SMS for critical events
   - Driver acceptance, ride completion
   
3. Use SQS for async processing
   - 30K+ messages = still free tier
```

## AWS Free Tier Summary

**Always Available**:
- Cognito: 50K users/month
- DynamoDB: 25 GB storage + limited RCU/WCU
- S3: 5 GB storage
- Lambda: 1M requests + 400K GB-seconds
- CloudWatch: 5 GB logs ingestion + storage
- SQS: 1M requests

**12 Months Free**:
- API Gateway: 1M requests
- SNS: 1K emails
- CloudTrail: 1 trail

## Budget Alerts Setup

```bash
# Create CloudWatch budget alert
aws budgets create-budget \
  --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget file://budget-config.json \
  --notifications-with-subscribers file://notifications.json

# Example budget-config.json:
{
  "Budget": {
    "BudgetName": "Monthly-Limit",
    "BudgetLimit": {
      "Amount": "50",
      "Unit": "USD"
    },
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST"
  }
}
```

## Cost Estimation Tool

```bash
# Simple cost estimator script
# Customize with your expected traffic

MONTHLY_RIDES=1000
MONTHLY_USERS=500

API_COST=$(echo "scale=2; $MONTHLY_RIDES * 100 * 3.50 / 1000000" | bc)
LAMBDA_COST=$(echo "scale=2; $MONTHLY_RIDES * 1000 * 0.0000166667" | bc)
DYNAMODB_COST=$(echo "scale=2; $MONTHLY_RIDES * 2 * 6.25 / 1000000 + $MONTHLY_USERS * 1.25 / 1000000" | bc)

TOTAL=$(echo "scale=2; $API_COST + $LAMBDA_COST + $DYNAMODB_COST" | bc)

echo "Estimated Monthly Cost: \$$TOTAL"
```

## Scaling Cost Analysis

```
Rides/Day → Monthly Cost

        100 →      $4
      1,000 →     $32
     10,000 →    $340
    100,000 →  $3,400
  1,000,000 → $34,000 (with reserved capacity: ~$15,000)
```

## Tips for Cost Control

1. ✅ **Start with on-demand**: Scale to reserved when confident
2. ✅ **Monitor daily**: Set CloudWatch dashboard
3. ✅ **Tag resources**: Understand cost per service/environment
4. ✅ **Clean up**: Delete unused tables, buckets, functions
5. ✅ **Optimize queries**: Efficient DynamoDB access patterns
6. ✅ **Cache aggressively**: API Gateway + CloudFront
7. ✅ **Compress logs**: Reduce CloudWatch ingestion
8. ✅ **Test in staging**: Identify cost issues before production

---

**Cost Calculator**: https://calculator.aws/
**Pricing Pages**: 
- API Gateway: https://aws.amazon.com/api-gateway/pricing/
- Lambda: https://aws.amazon.com/lambda/pricing/
- DynamoDB: https://aws.amazon.com/dynamodb/pricing/

**Version**: 1.0
**Last Updated**: 2026-11-19
