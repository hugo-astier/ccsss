FROM node:latest

RUN git clone https://github.com/Maltcommunity/ccsss.git /opt/ccsss

WORKDIR /opt/ccsss

RUN npm install --production

EXPOSE 8888

CMD ["/opt/ccsss/bin/ccsss"]
