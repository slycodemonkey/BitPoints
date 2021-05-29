FROM node:lts-slim

EXPOSE 80
ENV NODE_ENV production

RUN apt-get update || : && apt-get install -y \
    python \
    build-essential
COPY package*.json ./
RUN npm install --only=production
COPY . .

CMD ["npm", "start"]
