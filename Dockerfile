FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies like typescript)
RUN npm install

# Copy source code
COPY . .

# Compile TypeScript to JavaScript
RUN npm run build

# Remove development dependencies to keep image size small
RUN npm prune --production

# Expose the API port
EXPOSE 5000

# Set environment to production
ENV NODE_ENV=production

# Start the server
CMD ["npm", "start"]

