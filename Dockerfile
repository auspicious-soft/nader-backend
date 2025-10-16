##############################################################################
# Backend Dockerfile
##############################################################################

# Step 1: Use a Node.js base image
FROM node:18-alpine

# Step 2: Set working directory inside the container
WORKDIR /app

# Step 3: Install ffmpeg and ffprobe inside the container
RUN apk update && apk add --no-cache ffmpeg

# Step 4: Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Step 5: Install ts-node globally
RUN npm install -g ts-node typescript

# Step 6: Copy the rest of the app source code to the container
COPY . .

# Step 7: Expose the application port
EXPOSE 8000

# Step 8: Run the app
CMD ["npm", "start"]
