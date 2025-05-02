# Use Python base image
FROM python:3.12-slim

# Set working directory
WORKDIR /workspace

# Install Python dependencies
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy the full Django project
COPY . .
