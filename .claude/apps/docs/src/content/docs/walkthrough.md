---
title: A Walkthrough of Contract Testing with Entente
description: Step-by-step visual guide showing how to implement contract testing with Entente, from initial setup to production deployment
---

This walkthrough demonstrates the complete Entente contract testing workflow using our example castle-service (provider) and castle-client (consumer). Follow along to see how contract testing works in practice.

## Step 1: Initial Project Setup

<img src="/images/intro/01.png" alt="Initial Setup" class="walkthrough-screenshot" />

Setting up the basic project structure and dependencies for both the provider and consumer services.

## Step 2: Provider OpenAPI Specification

<img src="/images/intro/02.png" alt="Provider OpenAPI Spec" class="walkthrough-screenshot" />

Creating the OpenAPI specification that defines the contract for the castle-service API.

## Step 3: Consumer Service Configuration

<img src="/images/intro/03.png" alt="Consumer Configuration" class="walkthrough-screenshot" />

Configuring the castle-client to connect to the Entente service and specify which provider it depends on.

## Step 4: Mock Server Creation

<img src="/images/intro/04.png" alt="Mock Server Creation" class="walkthrough-screenshot" />

The consumer creates a mock server from the provider's OpenAPI specification for testing.

## Step 5: Test Execution with Mocks

<img src="/images/intro/05.png" alt="Test Execution" class="walkthrough-screenshot" />

Running consumer tests against the mock server with automatic interaction recording enabled.

## Step 6: Interaction Recording

<img src="/images/intro/06.png" alt="Interaction Recording" class="walkthrough-screenshot" />

The Entente consumer library automatically records all API interactions during test execution.

## Step 7: Recording Upload

<img src="/images/intro/07.png" alt="Recording Upload" class="walkthrough-screenshot" />

Recorded interactions are uploaded to the Entente central service for storage and later verification.

## Step 8: Provider Verification Setup

<img src="/images/intro/08.png" alt="Provider Verification Setup" class="walkthrough-screenshot" />

The provider service configures verification to replay recorded consumer interactions.

## Step 9: State Handler Configuration

<img src="/images/intro/09.png" alt="State Handler Configuration" class="walkthrough-screenshot" />

Setting up state handlers to prepare the provider service with the correct data before each verification.

## Step 10: Running Provider Verification

<img src="/images/intro/10.png" alt="Provider Verification" class="walkthrough-screenshot" />

The provider replays recorded consumer interactions against its real implementation.

## Step 11: Verification Results

<img src="/images/intro/11.png" alt="Verification Results" class="walkthrough-screenshot" />

Viewing the results of provider verification to ensure all consumer interactions pass.

## Step 12: Fixture Generation

<img src="/images/intro/12.png" alt="Fixture Generation" class="walkthrough-screenshot" />

Successful verifications automatically generate fixtures based on real provider responses.

## Step 13: Fixture Approval Workflow

<img src="/images/intro/13.png" alt="Fixture Approval" class="walkthrough-screenshot" />

New fixtures enter an approval workflow where teams can review and approve them for use.

## Step 14: CI/CD Integration

<img src="/images/intro/14.png" alt="CI/CD Integration" class="walkthrough-screenshot" />

Integrating Entente into continuous integration pipelines for automated testing.

## Step 15: Consumer CI Pipeline

<img src="/images/intro/15.png" alt="Consumer CI Pipeline" class="walkthrough-screenshot" />

The consumer's CI pipeline runs tests with recording enabled and uploads interactions.

## Step 16: Provider CI Pipeline

<img src="/images/intro/16.png" alt="Provider CI Pipeline" class="walkthrough-screenshot" />

The provider's CI pipeline runs verification against all recorded consumer interactions.

## Step 17: Deployment Safety Checks

<img src="/images/intro/17.png" alt="Deployment Safety Checks" class="walkthrough-screenshot" />

Using "can-i-deploy" checks to verify compatibility before deploying to production.

## Step 18: Consumer Deployment Check

<img src="/images/intro/18.png" alt="Consumer Deployment Check" class="walkthrough-screenshot" />

The consumer checks if their version is compatible with deployed provider versions.

## Step 19: Provider Deployment Check

<img src="/images/intro/19.png" alt="Provider Deployment Check" class="walkthrough-screenshot" />

The provider checks if their version satisfies all consumer contracts before deployment.

## Step 20: Production Deployment

<img src="/images/intro/20.png" alt="Production Deployment" class="walkthrough-screenshot" />

Deploying to production with confidence after all contract tests pass.

## Step 21: Deployment Registration

<img src="/images/intro/21.png" alt="Deployment Registration" class="walkthrough-screenshot" />

Registering the successful deployment with Entente for future compatibility checks.

## Step 22: Monitoring and Alerts

<img src="/images/intro/22.png" alt="Monitoring and Alerts" class="walkthrough-screenshot" />

Setting up monitoring and alerts for contract test failures and deployment issues.

## Step 23: Breaking Change Detection

<img src="/images/intro/23.png" alt="Breaking Change Detection" class="walkthrough-screenshot" />

Demonstrating how Entente detects and prevents breaking changes from reaching production.

## Step 24: Complete Workflow Summary

<img src="/images/intro/24.png" alt="Workflow Summary" class="walkthrough-screenshot" />

A complete overview of the Entente contract testing workflow from development to production.

## Key Takeaways

This walkthrough demonstrates how Entente provides:

- **Automated Contract Testing**: No manual mock creation or maintenance required
- **Real Interaction Recording**: Tests use actual API calls, not theoretical scenarios
- **Provider Verification**: Ensures implementations satisfy real consumer usage patterns
- **Deployment Safety**: Prevents breaking changes through compatibility checks
- **Fixture Management**: Realistic test data based on actual API responses

## Next Steps

Now that you've seen the complete workflow:

1. **[Set up your provider](/providers/)** - Configure OpenAPI specs and verification
2. **[Set up your consumer](/consumers/)** - Create mocks and enable recording
3. **[Integrate with CI/CD](/github-actions/)** - Automate contract testing in your pipelines
4. **[Manage fixtures](/fixtures/)** - Implement the approval workflow for your team