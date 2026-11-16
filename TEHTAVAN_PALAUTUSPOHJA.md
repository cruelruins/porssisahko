# Automaattinen verkkosivuston julkaisu GitHubin kautta – palautuspohja

## 1. Linkit

- GitHub-repository: [Lisää repositoryn URL]
- Julkaistu verkkosivusto: [Lisää Azure App Servicen tai webhotellin URL]

## 2. GitHub Actions -julkaisun todiste

Lisää tähän kuvakaappaus onnistuneesta ajosta repositoryn Actions-välilehdeltä. Varmista, ettei kuvassa näy salasanoja, salaisuuksia tai yksityisiä tunnuksia.

## 3. Teoriaosuuden vastaukset

**Mikä on GitHub Actions?**

GitHub Actions on GitHubin automaatiopalvelu, jolla voidaan suorittaa työnkulkuja esimerkiksi aina, kun repositoryyn lisätään uusi muutos.

**Mitä Continuous Deployment tarkoittaa?**

Continuous Deployment tarkoittaa, että koodimuutokset julkaistaan automaattisesti määriteltyyn palvelinympäristöön.

**Mikä on YAML-tiedosto?**

YAML on ihmisen luettavissa oleva tekstimuotoinen tiedostomuoto, jota käytetään esimerkiksi GitHub Actionsin työnkulkujen määrittelyyn.

**Miksi FTP-tunnuksia ei saa kirjoittaa suoraan julkaistavaan koodiin?**

Koodia voi lukea moni henkilö, jolloin tunnukset voisivat paljastua. Tunnukset tallennetaan GitHub Secrets -asetuksiin, joista työnkulku lukee ne turvallisemmin.

**Mitä hyötyä automaattisesta julkaisusta on verrattuna käsin tehtävään FTP-siirtoon?**

Automaattinen julkaisu säästää aikaa, vähentää unohtamisen ja väärien tiedostojen siirtämisen riskiä sekä tekee julkaisusta samanlaisen jokaisella kerralla.

## 4. Testaus

- [ ] Sivuston koodi on GitHub-repositoryssa.
- [ ] FTP-tunnukset on lisätty GitHub Secrets -asetuksiin.
- [ ] Työnkulku käynnistyi `main`-haaraan tehdyn muutoksen jälkeen.
- [ ] GitHub Actionsin julkaisu päättyi onnistuneesti.
- [ ] Muutos näkyi julkaistulla verkkosivustolla ilman FTP-ohjelman käyttöä.

## 5. Oma pohdinta

Automaattinen julkaisu on hyödyllinen työelämässä, koska kehittäjät voivat keskittyä sivuston kehittämiseen eikä tiedostojen manuaaliseen siirtämiseen. Julkaisuprosessi on nopeampi, yhdenmukainen ja helpompi tarkistaa. Virhetilanteista jää lokitieto GitHub Actionsiin.
