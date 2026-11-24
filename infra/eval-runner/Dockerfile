# Image for the scheduled evaluation run (lab/eval).
# Build from the repository root so the app's own modules are in the image:
#   docker build -f infra/eval-runner/Dockerfile -t murmur-eval .
#
# The harness is Python, and it calls the app's real JavaScript through a small Node bridge,
# so the image carries both runtimes. It holds test cases and app code only. No user data
# exists anywhere in this repository, so none can end up in the image.

FROM node:22-bookworm-slim AS node

FROM python:3.12-slim-bookworm

COPY --from=node /usr/local/bin/node /usr/local/bin/node

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN useradd --create-home --uid 10001 runner
WORKDIR /app

# boto3 is needed for Bedrock and for the upload step even if the harness lists nothing else.
COPY lab/eval/ lab/eval/
RUN pip install "boto3>=1.35,<2" \
    && if [ -f lab/eval/requirements.txt ]; then pip install -r lab/eval/requirements.txt; fi

# The bridge imports the app's modules; package.json marks them as ES modules.
COPY package.json ./
COPY js/ js/
COPY data/ data/
COPY infra/eval-runner/entrypoint.sh infra/eval-runner/upload_results.py /usr/local/bin/
RUN true \
    && chmod 0755 /usr/local/bin/entrypoint.sh \
    && mkdir -p /app/lab/eval/runs \
    && chown -R runner:runner /app/lab/eval/runs

USER runner
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["python3", "-m", "lab.eval.run", "--provider", "bedrock", "--cases", "lab/eval/cases"]
