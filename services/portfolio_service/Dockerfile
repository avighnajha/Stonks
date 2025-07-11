# services/user-service/Dockerfile (Optimized for Development)

# Start with the official Node.js image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy ONLY the package files to leverage Docker caching
COPY package*.json ./

# Install ALL dependencies, including devDependencies, which we need for `nest`
RUN npm install

# This just tells Docker what port the container will eventually listen on.
EXPOSE 3005
