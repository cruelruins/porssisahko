# pörssisähkön web-sovellus

Responsiivinen suomenkielinen pörssisähkön hintanäkymä. Sovellus hakee Suomen varttihinnat Porssisahko.net API v2 -rajapinnasta ja näyttää nykyisen hinnan, seuraavan vuorokauden keskiarvon, halvimmat ja kalleimmat vartit, hintakaavion sekä edullisimman neljän tunnin jakson.

Sovellus on staattinen HTML/CSS/JavaScript-sivusto. Se ei tarvitse Python-palvelinta, Node-palvelinta eikä build-vaihetta. Siksi sama `site/`-kansio voidaan julkaista Azure App Serviceen FTPS-yhteydellä tai tavalliseen FTP/FTPS-verkkohotelliin.

https://rg-porssisahko-e8e5gubshqdwf9ff.swedencentral-01.azurewebsites.net/
