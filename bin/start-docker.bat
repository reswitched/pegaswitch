@echo off

PUSHD %~dp0\..
SET ROOT_DIR=%CD%
POPD

WHERE docker
IF %ERRORLEVEL% NEQ 0 ECHO Docker must be installed to use this feature. Exiting...

set BIND_ADDRESS=0.0.0.0

set DNS_PORT=53
set WEB_PORT=80
set OTHER_PORT=8100

ECHO Starting PegaSwitch...

ECHO Windows may require permissions to access files. Be sure to watch for prompts/open windows by Docker.

IF NOT EXIST %CD%\node_modules (
    ECHO Node modules will be installed on first run
)

docker run --rm -it^
 --name "pegaswitch"^
 -v %ROOT_DIR%:"/opt/pegaswitch"^
 -w "/opt/pegaswitch"^
 -p %BIND_ADDRESS%:%DNS_PORT%:53^
 -p %BIND_ADDRESS%:%WEB_PORT%:80^
 -p %BIND_ADDRESS%:%OTHER_PORT%:8100^
 node:8 "/bin/bash" "-c" "if [ -d node_modules ]; then npm install; fi; npm run start;"