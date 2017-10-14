FROM node
MAINTAINER https://github.com/reswitched/pegaswitch

# Copy the pegaswitch code into the runtime
COPY . /src
WORKDIR "/src"
# Install dependencies
RUN npm install
# Run it
CMD ["node","start.js"]
