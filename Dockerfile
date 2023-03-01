FROM node:16-alpine
WORKDIR /app

ADD . . 
RUN npm install
RUN npm run build
CMD ["npm", "run"]
```