# Verification

Run the automated checks from the repository root:

`node --test tests/core.test.cjs tests/cloud.test.cjs tests/service-worker.test.cjs`

The cloud tests use a simulated service and never change live account records.
