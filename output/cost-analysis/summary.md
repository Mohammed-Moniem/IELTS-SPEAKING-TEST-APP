# Repo Cost Analysis

Generated at: `2026-03-06T01:57:17.879359+00:00`
Repository source: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP`
Repository commit: `dfe867523b29e3506b2cd5ed0b093c9febd2ecc8`

## Confidence

Overall confidence score: **0.702**
- Architecture signal strength: 0.84
- Load profile confidence: 0.45
- Pricing confidence: 0.78
- Third-party confidence: 0.58

## Assumptions

- Locale: `global-blended`
- Currency: `USD`
- Pricing timestamp: `2026-03-06T01:54:45.148474+00:00`
- Stale pricing: `False`
- Annual model: `flat_monthly_baseline`

## Top Recommendations

| Rank | Provider | Monthly Base | Overall Score | Rationale |
| --- | --- | --- | --- | --- |
| 1 | cloudflare | 2420.99 | 0.953 | Cost score 1.0; scalability score 0.91; ops score 0.9 |
| 2 | aws | 5150.97 | 0.7098 | Cost score 0.57; scalability score 0.95; ops score 0.7 |
| 3 | azure | 5167.43 | 0.6985 | Cost score 0.567; scalability score 0.93; ops score 0.68 |

## Provider Scenario Summary

| Provider | Low Monthly | Medium Monthly | High Monthly | Avg Annual | Confidence |
| --- | --- | --- | --- | --- | --- |
| aws | 506.31 | 1382.14 | 13564.45 | 61811.64 | 0.702 |
| azure | 323.81 | 1241.84 | 13936.63 | 62009.1 | 0.702 |
| cloudflare | 345.53 | 750.66 | 6166.78 | 29051.85 | 0.641 |
| gcp | 500.41 | 1564.07 | 16397.11 | 73846.36 | 0.641 |
| vercel | 671.24 | 2194.92 | 23425.15 | 105165.25 | 0.641 |

## Provider Detail: aws

- low: monthly `506.31` (range `354.42` to `658.21`), annual `6075.76`
- medium: monthly `1382.14` (range `967.5` to `1796.78`), annual `16585.7`
- high: monthly `13564.45` (range `9495.12` to `17633.79`), annual `162773.45`

### Medium Scenario Component Breakdown

| Component | Category | Min | Base | Max | Notes |
| --- | --- | --- | --- | --- | --- |
| shared-network-egress | network | 373.75 | 533.94 | 694.12 | External data transfer |
| shared-observability | observability | 175.19 | 250.26 | 325.34 | Metrics/log ingestion and retention |
| api-service-1 | compute | 116.28 | 166.11 | 215.95 | Provisioned compute + request uplifts |
| container-service-1 | compute | 116.28 | 166.11 | 215.95 | Provisioned compute + request uplifts |
| relational-db-1 | database | 68.25 | 97.5 | 126.75 | Managed PostgreSQL baseline by data size |
| web-frontend-1 | frontend | 43.06 | 61.52 | 79.97 | Request-driven frontend/edge execution |
| shared-object-storage | storage | 2.94 | 4.2 | 5.46 | Object storage capacity |

### Medium Scenario Third-Party Costs

| Vendor | Monthly Base | Assumption Notes |
| --- | --- | --- |
| openai | 40.0 | Assumes blended token usage for model calls. |
| stripe | 8.2 | Represents operational overhead, not payment processing percentage fees. |
| supabase | 29.0 | Assumes paid project tier plus storage growth. |
| firebase | 25.3 | Assumes Blaze pay-as-you-go usage. |

## Provider Detail: azure

- low: monthly `323.81` (range `226.66` to `420.95`), annual `3885.67`
- medium: monthly `1241.84` (range `869.29` to `1614.4`), annual `14902.13`
- high: monthly `13936.63` (range `9755.64` to `18117.61`), annual `167239.5`

### Medium Scenario Component Breakdown

| Component | Category | Min | Base | Max | Notes |
| --- | --- | --- | --- | --- | --- |
| shared-network-egress | network | 361.3 | 516.14 | 670.98 | External data transfer |
| shared-observability | observability | 189.2 | 270.29 | 351.37 | Metrics/log ingestion and retention |
| relational-db-1 | database | 131.07 | 187.25 | 243.42 | Managed PostgreSQL baseline by data size |
| web-frontend-1 | frontend | 50.8 | 72.58 | 94.35 | Request-driven frontend/edge execution |
| api-service-1 | compute | 31.25 | 44.64 | 58.03 | Provisioned compute + request uplifts |
| container-service-1 | compute | 31.25 | 44.64 | 58.03 | Provisioned compute + request uplifts |
| shared-object-storage | storage | 2.67 | 3.82 | 4.97 | Object storage capacity |

### Medium Scenario Third-Party Costs

| Vendor | Monthly Base | Assumption Notes |
| --- | --- | --- |
| openai | 40.0 | Assumes blended token usage for model calls. |
| stripe | 8.2 | Represents operational overhead, not payment processing percentage fees. |
| supabase | 29.0 | Assumes paid project tier plus storage growth. |
| firebase | 25.3 | Assumes Blaze pay-as-you-go usage. |

## Provider Detail: cloudflare

- low: monthly `345.53` (range `172.76` to `518.29`), annual `4146.33`
- medium: monthly `750.66` (range `375.33` to `1125.99`), annual `9007.89`
- high: monthly `6166.78` (range `3083.39` to `9250.17`), annual `74001.33`

### Medium Scenario Component Breakdown

| Component | Category | Min | Base | Max | Notes |
| --- | --- | --- | --- | --- | --- |
| shared-observability | observability | 100.11 | 200.21 | 300.32 | Metrics/log ingestion and retention |
| shared-network-egress | network | 59.33 | 118.65 | 177.98 | External data transfer |
| api-service-1 | compute | 57.42 | 114.85 | 172.27 | Provisioned compute + request uplifts |
| container-service-1 | compute | 57.42 | 114.85 | 172.27 | Provisioned compute + request uplifts |
| web-frontend-1 | frontend | 29.55 | 59.1 | 88.65 | Request-driven frontend/edge execution |
| relational-db-1 | database | 18.75 | 37.5 | 56.25 | Managed PostgreSQL baseline by data size |
| shared-object-storage | storage | 1.5 | 3.0 | 4.5 | Object storage capacity |

### Medium Scenario Third-Party Costs

| Vendor | Monthly Base | Assumption Notes |
| --- | --- | --- |
| openai | 40.0 | Assumes blended token usage for model calls. |
| stripe | 8.2 | Represents operational overhead, not payment processing percentage fees. |
| supabase | 29.0 | Assumes paid project tier plus storage growth. |
| firebase | 25.3 | Assumes Blaze pay-as-you-go usage. |

## Provider Detail: gcp

- low: monthly `500.41` (range `250.21` to `750.62`), annual `6004.98`
- medium: monthly `1564.07` (range `782.03` to `2346.1`), annual `18768.83`
- high: monthly `16397.11` (range `8198.55` to `24595.66`), annual `196765.26`

### Medium Scenario Component Breakdown

| Component | Category | Min | Base | Max | Notes |
| --- | --- | --- | --- | --- | --- |
| shared-network-egress | network | 355.96 | 711.91 | 1067.87 | External data transfer |
| shared-observability | observability | 125.13 | 250.26 | 375.4 | Metrics/log ingestion and retention |
| api-service-1 | compute | 79.97 | 159.94 | 239.92 | Provisioned compute + request uplifts |
| container-service-1 | compute | 79.97 | 159.94 | 239.92 | Provisioned compute + request uplifts |
| relational-db-1 | database | 52.5 | 105.0 | 157.5 | Managed PostgreSQL baseline by data size |
| web-frontend-1 | frontend | 35.25 | 70.5 | 105.75 | Request-driven frontend/edge execution |
| shared-object-storage | storage | 2.0 | 4.0 | 6.0 | Object storage capacity |

### Medium Scenario Third-Party Costs

| Vendor | Monthly Base | Assumption Notes |
| --- | --- | --- |
| openai | 40.0 | Assumes blended token usage for model calls. |
| stripe | 8.2 | Represents operational overhead, not payment processing percentage fees. |
| supabase | 29.0 | Assumes paid project tier plus storage growth. |
| firebase | 25.3 | Assumes Blaze pay-as-you-go usage. |

## Provider Detail: vercel

- low: monthly `671.24` (range `335.62` to `1006.86`), annual `8054.88`
- medium: monthly `2194.92` (range `1097.46` to `3292.38`), annual `26339.04`
- high: monthly `23425.15` (range `11712.58` to `35137.73`), annual `281101.84`

### Medium Scenario Component Breakdown

| Component | Category | Min | Base | Max | Notes |
| --- | --- | --- | --- | --- | --- |
| shared-network-egress | network | 444.95 | 889.89 | 1334.84 | External data transfer |
| shared-observability | observability | 250.26 | 500.53 | 750.79 | Metrics/log ingestion and retention |
| api-service-1 | compute | 114.85 | 229.7 | 344.54 | Provisioned compute + request uplifts |
| container-service-1 | compute | 114.85 | 229.7 | 344.54 | Provisioned compute + request uplifts |
| relational-db-1 | database | 67.5 | 135.0 | 202.5 | Managed PostgreSQL baseline by data size |
| web-frontend-1 | frontend | 50.8 | 101.61 | 152.41 | Request-driven frontend/edge execution |
| shared-object-storage | storage | 3.0 | 6.0 | 9.0 | Object storage capacity |

### Medium Scenario Third-Party Costs

| Vendor | Monthly Base | Assumption Notes |
| --- | --- | --- |
| openai | 40.0 | Assumes blended token usage for model calls. |
| stripe | 8.2 | Represents operational overhead, not payment processing percentage fees. |
| supabase | 29.0 | Assumes paid project tier plus storage growth. |
| firebase | 25.3 | Assumes Blaze pay-as-you-go usage. |

## Pricing Source Checks

| Provider | Status | HTTP | Checked At | Source URL |
| --- | --- | --- | --- | --- |
| aws | ok | 200 | 2026-03-06T01:54:45.148497+00:00 | https://aws.amazon.com/ec2/pricing/on-demand/ |
| aws | ok | 200 | 2026-03-06T01:54:45.528706+00:00 | https://aws.amazon.com/s3/pricing/ |
| aws | ok | 200 | 2026-03-06T01:54:45.856228+00:00 | https://aws.amazon.com/rds/postgresql/pricing/ |
| aws | ok | 200 | 2026-03-06T01:54:46.739520+00:00 | https://aws.amazon.com/lambda/pricing/ |
| aws | ok | 200 | 2026-03-06T01:54:47.054556+00:00 | https://aws.amazon.com/cloudwatch/pricing/ |
| aws | ok | 200 | 2026-03-06T01:54:47.371131+00:00 | https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSLambda/current/us-east-1/index.json |
| aws | ok | 200 | 2026-03-06T01:54:47.998253+00:00 | https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/us-east-1/index.json |
| aws | ok | 200 | 2026-03-06T01:54:48.911843+00:00 | https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonRDS/current/us-east-1/index.json |
| azure | ok | 200 | 2026-03-06T01:55:10.881790+00:00 | https://azure.microsoft.com/pricing/details/virtual-machines/linux/ |
| azure | error | - | 2026-03-06T01:55:29.898899+00:00 | https://azure.microsoft.com/pricing/details/storage/blobs/ |
| azure | ok | 200 | 2026-03-06T01:55:53.312119+00:00 | https://azure.microsoft.com/pricing/details/postgresql/server/ |
| azure | ok | 200 | 2026-03-06T01:56:12.072472+00:00 | https://azure.microsoft.com/pricing/details/functions/ |
| azure | ok | 200 | 2026-03-06T01:56:32.649769+00:00 | https://azure.microsoft.com/pricing/details/bandwidth/ |
| azure | ok | 200 | 2026-03-06T01:56:51.587510+00:00 | https://azure.microsoft.com/pricing/details/monitor/ |
| azure | ok | 200 | 2026-03-06T01:57:11.812932+00:00 | https://prices.azure.com/api/retail/prices?$top=1 |
| cloudflare | ok | 200 | 2026-03-06T01:57:16.236862+00:00 | https://www.cloudflare.com/plans/developer-platform/ |
| cloudflare | ok | 200 | 2026-03-06T01:57:17.130371+00:00 | https://developers.cloudflare.com/workers/platform/pricing/ |
| cloudflare | error | - | 2026-03-06T01:57:17.382276+00:00 | https://www.cloudflare.com/products/r2/pricing/ |
| gcp | ok | 200 | 2026-03-06T01:55:01.986424+00:00 | https://cloud.google.com/compute/vm-instance-pricing |
| gcp | ok | 200 | 2026-03-06T01:55:03.066194+00:00 | https://cloud.google.com/storage/pricing |
| gcp | ok | 200 | 2026-03-06T01:55:04.133682+00:00 | https://cloud.google.com/sql/pricing |
| gcp | ok | 200 | 2026-03-06T01:55:05.200890+00:00 | https://cloud.google.com/functions/pricing-1stgen |
| gcp | ok | 200 | 2026-03-06T01:55:06.028672+00:00 | https://cloud.google.com/vpc/network-pricing |
| gcp | ok | 200 | 2026-03-06T01:55:09.305055+00:00 | https://cloud.google.com/monitoring/pricing |
| vercel | ok | 200 | 2026-03-06T01:57:13.515282+00:00 | https://vercel.com/pricing |
| vercel | error | - | 2026-03-06T01:57:13.757239+00:00 | https://vercel.com/docs/pricing/compute |
| vercel | ok | 200 | 2026-03-06T01:57:15.746792+00:00 | https://vercel.com/docs/pricing/networking |
