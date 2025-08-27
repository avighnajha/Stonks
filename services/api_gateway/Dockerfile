# services/api_gateway/Dockerfile

# Start with the official Node.js image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy ONLY the package files to leverage Docker caching
COPY package*.json ./

# Install ALL dependencies, including devDependencies
RUN npm install

# Expose the port the gateway will run on.
# This should match the PORT environment variable in your docker-compose.yml
EXPOSE 8080