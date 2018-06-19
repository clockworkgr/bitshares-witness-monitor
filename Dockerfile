FROM node:8-alpine

ADD . /bitshares-witness-monitor
WORKDIR /bitshares-witness-monitor

RUN npm install

CMD ["node", "index.js"]