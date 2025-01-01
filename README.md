# golf-tournament-app

## Steps

1. Open a terminal and using cd, move your current working directory to the root of golf-tournament-app
2. Create a .env file in the project's root directory.

```
$<Any_path>/golf-tournament-app/> touch .env
```

3. First we need to choose the admin's password. To do this, open up nodeJS's command line environment by typing node 

```
$<Any_path>/golf-tournament-app/> node
```

4. When in node's command line runtime environment/ REPL, copy the command from the code block below. ** Then paste it in node's command line and Replace the _<YOUR_PASSWORD_HERE>_ with the password you want to enter during admin's login**

```
require('crypto').createHash('sha256').update('<YOUR_PASSWORD_HERE>').digest('hex')
```

It should look something like this

```
$<Any_path>/golf-tournament-app/> node
Welcome to Node.js v20.17.0.
Type ".help" for more information.
> require('crypto').createHash('sha256').update('1234').digest('hex')
```

5. Then hit enter, It should output a long string with quotes.

```
$<Any_path>/golf-tournament-app/> node
Welcome to Node.js v20.17.0.
Type ".help" for more information.
> require('crypto').createHash('sha256').update('1234').digest('hex')
'88d4266fd4e6338d13b845fcf289579d209c897823b9217da3e161936f031589'
```

6. Copy that hashed string and then get out of the node's command line arguement by pressing Command key or ⌘ and C, two times (ctrl and C key on windows).

```
$<Any_path>/golf-tournament-app/> node
Welcome to Node.js v20.17.0.
Type ".help" for more information.
> require('crypto').createHash('sha256').update('1234').digest('hex')
'88d4266fd4e6338d13b845fcf289579d209c897823b9217da3e161936f031589'
>
(To exit, press Ctrl+C again or Ctrl+D or type .exit)
>
<Any_path>/golf-tournament-app/>
```

7. Open the .env file using any text editor and then enter the following

```
ADMIN_NAME=<ANY_ADMIN_NAME>
ADMIN_PASSWD=<PASTE_COPIED_HASH_HERE>
```

8. There should be no spaces inbetween the equal sign and the strings, and the strings should not have quotes around them. It should look like what's below

```
ADMIN_NAME=admin
ADMIN_PASSWD=88d4266fd4e6338d13b845fcf289579d209c897823b9217da3e161936f031589
```

9. Save the .env file and then from the terminal, type the following command : npm install

```
$<Any_path>/golf-tournament-app/> node
Welcome to Node.js v20.17.0.
Type ".help" for more information.
> require('crypto').createHash('sha256').update('1234').digest('hex')
'88d4266fd4e6338d13b845fcf289579d209c897823b9217da3e161936f031589'
>
(To exit, press Ctrl+C again or Ctrl+D or type .exit)
>
<Any_path>/golf-tournament-app/> npm install
```

After it has install all the required packages, It should say something like this

```
$<Any_path>/golf-tournament-app/> node
Welcome to Node.js v20.17.0.
Type ".help" for more information.
> require('crypto').createHash('sha256').update('1234').digest('hex')
'88d4266fd4e6338d13b845fcf289579d209c897823b9217da3e161936f031589'
>
(To exit, press Ctrl+C again or Ctrl+D or type .exit)
>
<Any_path>/golf-tournament-app/> npm install
added 210 packages, and audited 211 packages in 3s

46 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
<Any_path>/golf-tournament-app/>
```

10. Then type **clear** in your terminal to clear the terminal's output buffer

```
$<Any_path>/golf-tournament-app/>
```

You can also press Cmd and K.

11. Finally type node index.js and your app will run.

```
$<Any_path>/golf-tournament-app/> node index.js
```
