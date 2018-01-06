# Official image w/ LTS support
FROM node:8 

EXPOSE 53
EXPOSE 80
EXPOSE 8100

WORKDIR /opt/app

COPY . /opt/app/.

RUN rm -rf /opt/app/node_modules/
RUN mkdir -p /opt/node_modules
RUN ln -s /opt/node_modules/ /opt/app/.

RUN npm install

CMD ["npm", "start"]
