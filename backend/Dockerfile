FROM python:3.11-slim

WORKDIR /app

# Install system dependencies and language compilers
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    default-jdk \
    mono-mcs \
    mono-runtime \
    nodejs \
    npm \
    postgresql-client \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install TypeScript
RUN npm install -g typescript ts-node

# Download JPlag v4.3.0 (JDK 17 compatible) for plagiarism detection
RUN wget -q https://github.com/jplag/JPlag/releases/download/v4.3.0/jplag-4.3.0-jar-with-dependencies.jar \
    -O /opt/jplag.jar \
    || echo "WARN: JPlag JAR download failed - plagiarism checks will use fallback"

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create uploads directory
RUN mkdir -p /tmp/kriterion/uploads

# Expose port
EXPOSE 8000

# Run application with migrations
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
