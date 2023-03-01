FROM node:16-alpine
WORKDIR usr/src/app

ADD . . 
RUN npm install
RUN npm run build
CMD ["npm", "run"]
```