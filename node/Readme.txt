Must have ssh for your system which is natively supported in most operating systems
and its easy to set up.

_________________________________________________________________________________________
Set up NGROK
_________________________________________________________________________________________

To generate your key:
ssh-keygen -t rsa

Then sign up for ngrok, register your key and make ngrok.yml and follow their instructions
ngrok http --url=your-custom-url.ngrok-free.app 9000

_________________________________________________________________________________________
Or set up localhost.run
_________________________________________________________________________________________

Alternatively you can use localhost.run
Localhost.run server setup:
Upload to:
https://admin.localhost.run/

To start your local server:
run pythonserver.bat with python 3 installed

Type:
ssh -o ServerAliveInterval=60 -R 80:localhost:9000 localhost.run

Or to skip key for above steps type:
ssh -o ServerAliveInterval=60 -R 80:localhost:9000 nokey@localhost.run
Then you can take requests by the link it provides

_________________________________________________________________________________________
Then set up config file, index and bat file
__________________________________________________________________________________________

To set up your servers details and API keys, edit the config.js file in static directory 
If needed ctrl + f5 hard refresh gecko and restart server for changes to take effect.
Your password should be the same one you use to log into BitBay web markets as a node.
Also you public key should be registered so users know how to connect to you.

You can set the number of running threads in the config file(the default is 4). However,
when the server is running do not close any of the browser windows and do not take any
of the tabs out of focus. Please leave each firefox window on it's own. The windows can
however be minimized. You may occasionally look at the console or ngrok to report errors.

For security do not put sensitive files in the "static" directory

Next, so people can connect and test with the generic account you can replace the line
var serverPublicKey = ""
in the index.html file so you and any users can test the server remotely by visiting the
ngrok page link. Also replace the line in index.html that says
var apiUrl = "https://your-custom-url.ngrok-free.app/api";
with the URL of your ngrok server

Next, in pythonserver.bat replace the line that says:
start cmd /k "ngrok http --url=your-custom-url.ngrok-free.app 9000"
with the actual custom link of your ngrok server

Finally if you are building everything from python directly then replace the line:
server.exe
...with the following line:
python server.py

Otherwise you may use the prebuilt server executable. For security you may choose to download
your own copies of ngrok.exe and of geckodriver.exe as well

_________________________________________________________________________________________
Run the server
__________________________________________________________________________________________

Finally load "pythonserver.bat" which will automatically boot up your ngrok server and
your python server. You are of course able to edit the python code and index to run different
apis or use different locally run AI models.
