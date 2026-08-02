FROM node:24-slim
WORKDIR /app

RUN apt-get update && apt-get install -y libc6
COPY package.json package-lock.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD [ "npm", "run", "dev" ]