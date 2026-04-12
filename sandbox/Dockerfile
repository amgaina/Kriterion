FROM python:3.11-slim

WORKDIR /workspace

# Minimal sandbox image – supports Python + Java only

# Install Java (javac/java) for Java assignments
RUN apt-get update \
    && apt-get install -y --no-install-recommends default-jdk-headless ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for code execution
RUN useradd -m -u 1000 -s /bin/bash sandbox

# Set permissions
RUN chown -R sandbox:sandbox /workspace

USER sandbox

CMD ["python3", "--version"]
