# Pörssivirta – pörssisähkön web-sovellus

Responsiivinen suomenkielinen pörssisähkön hintanäkymä. Sovellus hakee Suomen varttihinnat Porssisahko.net API v2 -rajapinnasta ja näyttää nykyisen hinnan, seuraavan vuorokauden keskiarvon, halvimmat ja kalleimmat vartit, hintakaavion sekä edullisimman neljän tunnin jakson.

Sovellus on staattinen HTML/CSS/JavaScript-sivusto. Se ei tarvitse Python-palvelinta, Node-palvelinta eikä build-vaihetta. Siksi sama `site/`-kansio voidaan julkaista Azure App Serviceen FTPS-yhteydellä tai tavalliseen FTP/FTPS-verkkohotelliin.

## Kansiorakenne

```text
.
├── .github/
│   └── workflows/
│       └── ftp-deploy.yml
├── site/
│   ├── app.js
│   ├── favicon.svg
│   ├── index.html
│   └── styles.css
├── .gitignore
├── README.md
└── TEHTAVAN_PALAUTUSPOHJA.md
```

GitHub Actions julkaisee vain `site/`-kansion sisällön. README, tehtävän palautuspohja ja työnkulun asetukset eivät päädy sivuston julkiseen juurikansioon.

## Paikallinen testaus

Avaa `site/index.html` selaimessa tai käynnistä projektin juurikansiosta paikallinen palvelin:

```bash
python -m http.server 8000 --directory site
```

Avaa sitten `http://localhost:8000`. Hintatietojen lataus vaatii internet-yhteyden.

## Automaattinen julkaisu GitHubiin ja Azure App Serviceen

Tämä repository on valmis julkaistavaksi Azure App Serviceen FTPS-yhteydellä. FTP-julkaisu käynnistyy automaattisesti, kun `main`-haaraan pusketaan muutos `site/`-kansion tiedostoihin.

### 1. Luo GitHub-repository

1. Luo GitHubissa uusi repository.
2. Lataa tämän projektin tiedostot repositoryyn siten, että `.github/` ja `site/` ovat repositoryn juuressa.
3. Varmista, että olet `main`-haarassa.

### 2. Luo Azure App Service

1. Luo Azure Portaalissa uusi **App Service** (Web App).
2. Valitse **Windows**-käyttöjärjestelmä. Sovellus on staattinen HTML-sivusto. `site/web.config` määrittää `index.html`-tiedoston aloitussivuksi IIS-palvelimella.
3. Kun sovellus on luotu, avaa sen **Configuration**-asetukset.
4. Aseta FTP state -asetukseksi **FTPS only** ja tallenna. Varmista, että FTP Basic Auth Publishing Credentials ja SCM Basic Auth Publishing Credentials ovat käytössä, jos käytät FTP/S-julkaisua.
5. Avaa **Deployment Center → FTPS Credentials** ja kopioi kirjoitusoikeudellinen FTPS endpoint sekä sovelluksen tunnukset.
6. Azure App Servicen julkaisukansio on `/site/wwwroot/`.

Azure App Service -ohjeet: <https://learn.microsoft.com/azure/app-service/deploy-ftp>

> Azure App Service -palvelussa FTP/S-tunnukset ovat eri asia kuin Azure-portaalin kirjautumistunnukset. Käytä vain sovelluksen julkaisutunnuksia. Jos palvelun asetuksissa FTP/S-perustunnistautuminen on estetty, ota se käyttöön vain organisaatiosi tietoturvaohjeiden mukaisesti.

### 3. Lisää FTP-salaisuudet GitHubiin

Avaa repositoryn **Settings → Secrets and variables → Actions → New repository secret**. Lisää seuraavat kolme salaisuutta:

| Secretin nimi | Sisältö |
|---|---|
| `FTP_SERVER` | Azure App Servicen FTPS-isäntänimi ilman `ftps://`-alkuosaa |
| `FTP_USERNAME` | Azure App Servicen FTPS-julkaisukäyttäjätunnus |
| `FTP_PASSWORD` | Azure App Servicen FTPS-julkaisusalasana |

Älä kirjoita tunnuksia YAML-tiedostoon, HTML:ään tai JavaScriptiin. Älä tallenna niitä repositoryyn.

### 4. Tarkista julkaisuasetukset

Tiedosto `.github/workflows/ftp-deploy.yml` sisältää valmiin työnkulun. Azure App Serviceä varten olennaiset asetukset ovat:

```yaml
protocol: ftps
port: 21
local-dir: ./site/
server-dir: /site/wwwroot/
```

`FTP_SERVER`-salaisuuteen tulee pelkkä isäntänimi, esimerkiksi Azure-portaalin FTPS endpointista kopioitu host-osa. Käytössä on eksplisiittinen FTPS portissa 21. Älä sekoita tätä implisiittiseen FTPS:ään portissa 990.

Jos julkaiset tavalliselle webhotellille Azure App Servicen sijaan, vaihda `server-dir` palveluntarjoajan oikeaksi julkaisukansioksi (esimerkiksi `/public_html/`). Käytä FTPS:ää aina, kun palveluntarjoaja sitä tukee.

### 5. Testaa Continuous Deployment

1. Avaa repositoryn **Actions**-välilehti.
2. Valitse työnkulku **Julkaise pörssisähkö-sivusto FTP:llä**.
3. Tee testimuutos esimerkiksi tiedostoon `site/index.html` ja puske se `main`-haaraan.
4. Avaa Actions-välilehdeltä käynnistynyt suoritus.
5. Vihreä hyväksytty suoritus tarkoittaa, että FTP-toiminto onnistui.
6. Avaa Azure App Servicen verkkosoite ja päivitä selain. Uusi muutos pitäisi näkyä.

Voit käynnistää työnkulun myös käsin valitsemalla Actions → työnkulku → Run workflow.

## Miten sovellus hakee sähkönhinnat?

Selain tekee yhden pyynnön osoitteeseen `https://api.porssisahko.net/v2/latest-prices.json`. Rajapinta palauttaa uusimmat 48 tunnin hinnat 15 minuutin jaksoina. Sovellus näyttää hinnat muodossa snt/kWh, arvonlisävero mukaan lukien. Hinnat haetaan sivun avautuessa ja sen jälkeen viiden minuutin välein. Lisäksi selaimessa on lyhytaikainen välimuisti. Rajapinnan dokumentaatio: <https://porssisahko.net/api>.

## Virhetilanteiden selvittäminen

| Ongelma | Tarkista |
|---|---|
| FTP-palvelimen osoite väärin | `FTP_SERVER`-salaisuus; käytä vain host-nimeä, älä koko `ftps://`-URL:ia |
| Käyttäjätunnus tai salasana väärin | Kopioi FTPS-julkaisutunnukset uudelleen Azuresta; älä käytä Azure-kirjautumistunnuksia |
| Kohdehakemisto väärin | Azure App Servicessa `/site/wwwroot/`; tavallisessa webhotellissa palveluntarjoajan määrittämä kansio |
| Yhteyttä ei saada | Tarkista FTPS-only-asetus, portti 21, palvelimen saatavuus ja mahdolliset palomuurirajoitukset |
| GitHub Actions ei käynnisty | Tarkista, että muutos koski `site/`-kansiota ja että commit meni `main`-haaraan |
| Julkaisu onnistuu mutta selain näyttää vanhaa | Päivitä sivu välimuisti ohittaen (Ctrl+F5) ja tarkista, että `index.html` on `wwwroot`-kansiossa |
| Hintoja ei näy sivulla | Tarkista selaimen verkkoyhteys ja kehittäjäkonsoli; hintarajapinta voi olla tilapäisesti poissa käytöstä tai pyyntörajalla |

GitHub Actionsin suorituslokit löytyvät repositoryn **Actions**-välilehdeltä valitsemalla epäonnistunut ajo ja sen `deploy`-työ. Älä julkaise lokien mukana salasanoja tai muita salaisuuksia.

## Tehtävän teoriaosuuden vastaukset

1. **Mikä on GitHub Actions?** GitHubiin kuuluva automaatiopalvelu, joka suorittaa määriteltyjä työnkulkuja esimerkiksi koodimuutoksen jälkeen.
2. **Mitä Continuous Deployment tarkoittaa?** Koodimuutokset julkaistaan automaattisesti kohdeympäristöön, kun määritellyt ehdot täyttyvät.
3. **Mikä on YAML-tiedosto?** Tekstipohjainen, sisennyksiin perustuva tiedostomuoto asetusten ja rakenteisen tiedon kuvaamiseen. GitHub Actions -työnkulku määritellään YAML-tiedostossa.
4. **Miksi FTP-tunnuksia ei saa kirjoittaa koodiin?** Repositoryn lukijat voisivat nähdä tunnukset. GitHub Secrets säilyttää ne erillään lähdekoodista ja välittää ne työnkululle salaisina arvoina.
5. **Mitä hyötyä automaattisesta julkaisusta on?** Julkaisu nopeutuu, käsin tehtävät työvaiheet ja virheet vähenevät, julkaisu on toistettava ja sama prosessi toimii jokaisen muutoksen yhteydessä.

