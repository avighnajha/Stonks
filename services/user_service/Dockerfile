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
EXPOSE 3001


# # services/user-service/Dockerfile

# # ---- Base Stage ----
# FROM node:18-alpine AS base
# WORKDIR /usr/src/app
# COPY package*.json ./

# # ---- Dependencies Stage ----
# FROM base AS dependencies
# RUN npm install

# # ---- Build Stage ----
# FROM dependencies AS build
# COPY . .
# RUN npm run build

# # ---- Production Stage ----
# FROM base AS production
# COPY --from=build /usr/src/app/package*.json ./
# RUN npm install --only=production
# COPY --from=build /usr/src/app/dist ./dist

# EXPOSE 3001
# CMD ["node", "dist/main"]