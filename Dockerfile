FROM node:18-alpine
WORKDIR /usr/src/app
COPY uniz-shared ./uniz-shared
COPY uniz-outpass-service ./uniz-outpass-service
WORKDIR /usr/src/app/uniz-shared
RUN npm install
RUN npm run build
WORKDIR /usr/src/app/uniz-outpass-service
RUN npm install
RUN npm run build
CMD ["npm", "start"]
