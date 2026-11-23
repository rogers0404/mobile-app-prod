# Deploy the AWS backend

## Prerequisites

Use an AWS CLI profile with access to the intended account and region, plus Python 3.11, `pip`, and `zip` to build Lambda artifacts. Choose one environment name for both stacks and the artifact prefix. The templates accept `development`, `staging`, or `production`.

Prepare an S3 bucket in the deployment region for Lambda ZIPs. Create or update the PayPal and Google Maps credentials in AWS Secrets Manager. The handlers expect PayPal JSON fields `client_id` and `secret`, and a Google Maps JSON field `api_key`. The [secret setup script](store-secrets.sh) prompts for these values and accepts the environment as its first argument. Use PayPal sandbox credentials with the checked-in Lambda template.

## Create or update the stacks

1. In CloudFormation, create or update the infrastructure stack with [cloudformation-template.yaml](cloudformation-template.yaml). Set `Environment` and review the account-specific values before applying the change set. When it completes, record the stage URL (`ApiEndpoint`), the API ID from API Gateway or the URL, and the `UserPoolId` and `UserPoolClientId` outputs.
2. From the repository root, build and upload the function ZIPs. Replace the region and bucket placeholders and use your chosen environment. Run the build in a Python 3.11 environment compatible with the Lambda runtime.

   ```sh
   AWS_DEFAULT_REGION=your-region bash aws-deployment/lambdas/build_and_upload.sh your-artifact-bucket staging
   ```

3. Create or update the second stack with [lambda-functions.yaml](lambda-functions.yaml). Use the same region and environment. Supply `LambdaCodeBucket`, `ApiGatewayId`, `CognitoUserPoolId`, `CognitoClientId`, `PayPalSecretArn`, and `GoogleMapsSecretArn` for this deployment. Copy the secret ARNs from Secrets Manager and review the template defaults, which include account-specific values. Review the named IAM resources before applying the change set.
4. Set the frontend's `EXPO_PUBLIC_BACKEND_URL` to the `ApiEndpoint` output, including the stage and omitting a trailing slash. Restart Expo or rebuild the app so it picks up the new URL. See the [project guide](../documentation/GETTING_STARTED.md#run-locally) for app setup.

The old `deploy.sh` path uses the legacy template and has a [known mismatch](BUGS.md#legacy-deploy-script). Use the two-stack process above for the checked-in Lambda handlers.

## Update and verify

Uploading ZIPs to the same S3 keys leaves the Lambda stack's code properties unchanged. For code-only releases, explicitly refresh each affected function using its new ZIP or deploy through a change set that references a new artifact key or version. Verify the function update completed before testing the stage.

Use test profiles and sandbox credentials for smoke checks.

- Create a rider and a driver, and fetch their profiles through the stage URL.
- Confirm a user with no active ride receives JSON `null`, then request and complete a ride with a verified test driver.
- Check autocomplete, place details, directions, and sandbox payment creation and capture.
- Check the [open bug list](BUGS.md#open-issues) before testing existing-user selection, realtime tracking, or notification delivery. Review API and Lambda logs for failures.

From the repository root, run the driver DynamoDB key regression tests with pytest installed.

```sh
python -m pytest -q tests/test_aws_driver_keys.py
```

## Operate the stage

Use CloudFormation stack events to diagnose deployment failures. Use API access logs and Lambda logs to diagnose request failures, and check dead-letter queue depth for asynchronous failures. Estimate costs for the intended region and traffic using expected requests, function duration, DynamoDB reads and writes, storage, logs, and external service usage. Configure a budget and review access controls in the target environment before exposing the API to public traffic.
