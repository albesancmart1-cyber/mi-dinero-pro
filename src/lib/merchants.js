// Catálogo de comercios y marcas habituales en España.
// Cada fila: [nombre, dominio (para el logo), categoría, alias extra "a|b", opciones]
// Opciones: 'exact' → solo se reconoce si el concepto es exactamente ese nombre
// (para marcas que son también palabras comunes: Dia, Mango, Once…).

const RAW = [
  // ---- Supermercados ----
  ['Mercadona', 'mercadona.es', 'c-super'],
  ['Carrefour', 'carrefour.es', 'c-super', 'carrefour express|carrefour market'],
  ['Lidl', 'lidl.es', 'c-super'],
  ['Aldi', 'aldi.es', 'c-super'],
  ['Dia', 'dia.es', 'c-super', 'supermercados dia|dia market|dia %|la plaza de dia', 'exact'],
  ['Alcampo', 'alcampo.es', 'c-super', 'auchan'],
  ['Eroski', 'eroski.es', 'c-super'],
  ['Consum', 'consum.es', 'c-super'],
  ['Hipercor', 'hipercor.es', 'c-super'],
  ['Supercor', 'supercor.es', 'c-super'],
  ['BM Supermercados', 'bmsupermercados.es', 'c-super', 'bm supermercado'],
  ['Ahorramás', 'ahorramas.com', 'c-super', 'ahorra mas'],
  ['Caprabo', 'caprabo.com', 'c-super'],
  ['Bonpreu', 'bonpreuesclat.cat', 'c-super', 'bonpreu esclat|esclat'],
  ['Condis', 'condis.es', 'c-super'],
  ['Gadis', 'gadis.es', 'c-super'],
  ['Froiz', 'froiz.com', 'c-super'],
  ['Covirán', 'coviran.es', 'c-super'],
  ['Spar', 'spar.es', 'c-super'],
  ['HiperDino', 'hiperdino.es', 'c-super', 'superdino'],
  ['Masymas', 'masymas.com', 'c-super', 'mas y mas'],
  ['Supermercados MAS', 'supermercadosmas.com', 'c-super'],
  ['Family Cash', 'familycash.es', 'c-super'],
  ['Alimerka', 'alimerka.es', 'c-super'],
  ['Lupa', 'superlupa.com', 'c-super', 'supermercados lupa', 'exact'],
  ['Plusfresc', 'plusfresc.cat', 'c-super'],
  ['Ametller Origen', 'ametllerorigen.com', 'c-super', 'ametller'],
  ['Makro', 'makro.es', 'c-super'],
  ['Costco', 'costco.es', 'c-super'],
  ['Simply', 'simply.es', 'c-super'],
  ['Primaprix', 'primaprix.es', 'c-super'],
  ['Unide', 'unide.es', 'c-super'],
  ['Dialprix', 'dialprix.es', 'c-super'],
  ['Carnicería', '', 'c-super', 'carniceria|fruteria|panaderia|pescaderia'],

  // ---- Grandes almacenes / compras generales ----
  ['El Corte Inglés', 'elcorteingles.es', 'c-ropa', 'corte ingles|eci'],
  ['Amazon', 'amazon.es', 'c-tecno', 'amzn|amazon marketplace|amazon es|amazon.es'],
  ['AliExpress', 'aliexpress.com', 'c-tecno', 'aliexpress'],
  ['Temu', 'temu.com', 'c-ropa'],
  ['Shein', 'shein.com', 'c-ropa'],
  ['eBay', 'ebay.es', 'c-tecno'],
  ['Wallapop', 'wallapop.com', 'c-otros-g'],
  ['Vinted', 'vinted.es', 'c-ropa'],
  ['Action', 'action.com', 'c-hogar', 'tiendas action', 'exact'],
  ['Tiger', 'flyingtiger.com', 'c-hogar', 'flying tiger'],
  ['Normal', 'normal.dk', 'c-belleza', 'tiendas normal', 'exact'],
  ['Miniso', 'miniso.es', 'c-hogar'],

  // ---- Moda / textil ----
  ['Zara', 'zara.com', 'c-ropa'],
  ['Zara Home', 'zarahome.com', 'c-hogar'],
  ['Pull&Bear', 'pullandbear.com', 'c-ropa', 'pull and bear|pull bear|pullandbear'],
  ['Bershka', 'bershka.com', 'c-ropa'],
  ['Stradivarius', 'stradivarius.com', 'c-ropa'],
  ['Massimo Dutti', 'massimodutti.com', 'c-ropa'],
  ['Oysho', 'oysho.com', 'c-ropa'],
  ['Lefties', 'lefties.com', 'c-ropa'],
  ['H&M', 'hm.com', 'c-ropa', 'h m|hym|h&m|hennes'],
  ['Mango', 'mango.com', 'c-ropa', 'mango man|mango outlet|tienda mango', 'exact'],
  ['Primark', 'primark.com', 'c-ropa'],
  ['Uniqlo', 'uniqlo.com', 'c-ropa'],
  ['C&A', 'c-and-a.com', 'c-ropa', 'c a|c&a|cya'],
  ['Springfield', 'springfield.com', 'c-ropa'],
  ['Cortefiel', 'cortefiel.com', 'c-ropa'],
  ["Women'secret", 'womensecret.com', 'c-ropa', 'womensecret|women secret'],
  ['Pedro del Hierro', 'pedrodelhierro.com', 'c-ropa'],
  ['Desigual', 'desigual.com', 'c-ropa'],
  ["Levi's", 'levi.com', 'c-ropa', 'levis|levi s'],
  ['Nike', 'nike.com', 'c-ropa'],
  ['Adidas', 'adidas.es', 'c-ropa'],
  ['Puma', 'puma.com', 'c-ropa'],
  ['New Balance', 'newbalance.es', 'c-ropa'],
  ['Converse', 'converse.com', 'c-ropa'],
  ['Vans', 'vans.es', 'c-ropa'],
  ['Skechers', 'skechers.es', 'c-ropa'],
  ['Under Armour', 'underarmour.es', 'c-ropa'],
  ['The North Face', 'thenorthface.es', 'c-ropa', 'north face'],
  ['Timberland', 'timberland.es', 'c-ropa'],
  ['Decathlon', 'decathlon.es', 'c-deporte'],
  ['JD Sports', 'jdsports.es', 'c-ropa', 'jd'],
  ['Foot Locker', 'footlocker.es', 'c-ropa', 'footlocker'],
  ['Sprinter', 'sprinter.es', 'c-deporte'],
  ['Forum Sport', 'forumsport.com', 'c-deporte'],
  ['Kiabi', 'kiabi.es', 'c-ropa'],
  ['Zalando', 'zalando.es', 'c-ropa'],
  ['ASOS', 'asos.com', 'c-ropa'],
  ['Scalpers', 'scalperscompany.com', 'c-ropa'],
  ['El Ganso', 'elganso.com', 'c-ropa'],
  ['Tommy Hilfiger', 'tommy.com', 'c-ropa', 'tommy'],
  ['Ralph Lauren', 'ralphlauren.es', 'c-ropa'],
  ['Calvin Klein', 'calvinklein.es', 'c-ropa'],
  ['Lacoste', 'lacoste.com', 'c-ropa'],
  ['Guess', 'guess.eu', 'c-ropa'],
  ['Pepe Jeans', 'pepejeans.com', 'c-ropa'],
  ['Tiffosi', 'tiffosi.com', 'c-ropa'],
  ['Bimba y Lola', 'bimbaylola.com', 'c-ropa', 'bimba lola'],
  ['Parfois', 'parfois.com', 'c-ropa'],
  ['Calzedonia', 'calzedonia.com', 'c-ropa'],
  ['Intimissimi', 'intimissimi.com', 'c-ropa'],
  ['Tezenis', 'tezenis.com', 'c-ropa'],
  ['Sfera', 'sfera.com', 'c-ropa'],
  ['Mayoral', 'mayoral.com', 'c-ropa'],
  ['Deichmann', 'deichmann.com', 'c-ropa'],
  ['Merkal', 'merkal.com', 'c-ropa'],
  ['Superdry', 'superdry.es', 'c-ropa'],
  ['Carhartt', 'carhartt-wip.com', 'c-ropa'],
  ['Quiksilver', 'quiksilver.es', 'c-ropa'],
  ['Victoria’s Secret', 'victoriassecret.com', 'c-ropa', 'victorias secret|victoria s secret'],
  ['Tous', 'tous.com', 'c-ropa'],
  ['Pandora', 'pandora.net', 'c-ropa'],
  ['Misako', 'misako.com', 'c-ropa'],
  ['Hugo Boss', 'hugoboss.com', 'c-ropa', 'boss'],

  // ---- Hogar y bricolaje ----
  ['IKEA', 'ikea.com', 'c-hogar'],
  ['Leroy Merlin', 'leroymerlin.es', 'c-hogar'],
  ['Bricomart', 'bricomart.es', 'c-hogar'],
  ['Bauhaus', 'bauhaus.es', 'c-hogar'],
  ['Brico Depôt', 'bricodepot.es', 'c-hogar', 'brico depot|bricodepot'],
  ['Maisons du Monde', 'maisonsdumonde.com', 'c-hogar'],
  ['Kave Home', 'kavehome.com', 'c-hogar'],
  ['JYSK', 'jysk.es', 'c-hogar'],
  ['Conforama', 'conforama.es', 'c-hogar'],
  ['Casa', 'casashops.com', 'c-hogar', 'casa shops', 'exact'],
  ['Sklum', 'sklum.com', 'c-hogar'],
  ['Muy Mucho', 'muymucho.es', 'c-hogar'],

  // ---- Tecnología ----
  ['Apple', 'apple.com', 'c-tecno', 'apple store|apple com|apple.com/bill|apple com bill'],
  ['MediaMarkt', 'mediamarkt.es', 'c-tecno', 'media markt'],
  ['PcComponentes', 'pccomponentes.com', 'c-tecno', 'pc componentes'],
  ['Fnac', 'fnac.es', 'c-tecno'],
  ['Worten', 'worten.es', 'c-tecno'],
  ['Samsung', 'samsung.com', 'c-tecno'],
  ['Xiaomi', 'mi.com', 'c-tecno'],
  ['Game', 'game.es', 'c-ocio', 'tiendas game', 'exact'],
  ['Back Market', 'backmarket.es', 'c-tecno', 'backmarket'],
  ['Coolmod', 'coolmod.com', 'c-tecno'],
  ['Microsoft', 'microsoft.com', 'c-tecno'],
  ['Google', 'google.com', 'c-tecno', 'google play|google store'],
  ['Sony', 'sony.es', 'c-tecno'],
  ['Dyson', 'dyson.es', 'c-hogar'],

  // ---- Belleza y cuidado personal ----
  ['Primor', 'primor.eu', 'c-belleza'],
  ['Druni', 'druni.es', 'c-belleza'],
  ['Sephora', 'sephora.es', 'c-belleza'],
  ['Douglas', 'douglas.es', 'c-belleza'],
  ['Rituals', 'rituals.com', 'c-belleza'],
  ['KIKO Milano', 'kikocosmetics.com', 'c-belleza', 'kiko'],
  ['Lush', 'lush.com', 'c-belleza'],
  ['Arenal', 'arenal.com', 'c-belleza', 'perfumerias arenal'],
  ['Clarel', 'clarel.es', 'c-belleza'],
  ['Notino', 'notino.es', 'c-belleza'],
  ['The Body Shop', 'thebodyshop.com', 'c-belleza', 'body shop'],
  ['Peluquería', '', 'c-belleza', 'peluqueria|barberia|barbero'],

  // ---- Salud ----
  ['Farmacia', '', 'c-salud', 'farmacia|parafarmacia'],
  ['Sanitas', 'sanitas.es', 'c-seguros'],
  ['Adeslas', 'segurcaixaadeslas.es', 'c-seguros', 'segurcaixa adeslas'],
  ['DKV', 'dkv.es', 'c-seguros'],
  ['Asisa', 'asisa.es', 'c-seguros'],
  ['Vitaldent', 'vitaldent.com', 'c-salud'],
  ['Multiópticas', 'multiopticas.com', 'c-salud', 'multiopticas'],
  ['General Óptica', 'generaloptica.es', 'c-salud', 'general optica'],
  ['Alain Afflelou', 'afflelou.es', 'c-salud', 'afflelou'],
  ['Opticalia', 'opticalia.com', 'c-salud'],
  ['Quirónsalud', 'quironsalud.com', 'c-salud', 'quironsalud|quiron'],
  ['HM Hospitales', 'hmhospitales.com', 'c-salud'],

  // ---- Restaurantes, cafeterías y comida a domicilio ----
  ["McDonald's", 'mcdonalds.es', 'c-rest', 'mcdonalds|mc donalds|mcdonald s|mcd'],
  ['Burger King', 'burgerking.es', 'c-rest', 'bk'],
  ['KFC', 'kfc.es', 'c-rest'],
  ['Telepizza', 'telepizza.es', 'c-rest'],
  ["Domino's Pizza", 'dominospizza.es', 'c-rest', 'dominos|domino s'],
  ['Pizza Hut', 'pizzahut.es', 'c-rest'],
  ["Papa John's", 'papajohns.es', 'c-rest', 'papa johns'],
  ['100 Montaditos', '100montaditos.com', 'c-rest', 'cien montaditos'],
  ['VIPS', 'vips.es', 'c-rest'],
  ['Goiko', 'goiko.com', 'c-rest', 'goiko grill'],
  ["Foster's Hollywood", 'fostershollywood.es', 'c-rest', 'fosters hollywood|fosters'],
  ['Ginos', 'ginos.es', 'c-rest'],
  ['The Good Burger', 'thegoodburger.com', 'c-rest', 'tgb'],
  ['Five Guys', 'fiveguys.es', 'c-rest'],
  ['Starbucks', 'starbucks.es', 'c-rest'],
  ['Tim Hortons', 'timhortons.es', 'c-rest'],
  ['Taco Bell', 'tacobell.es', 'c-rest'],
  ['Popeyes', 'popeyes.es', 'c-rest'],
  ['Subway', 'subway.com', 'c-rest'],
  ['Rodilla', 'rodilla.es', 'c-rest'],
  ['Pans & Company', 'pansandcompany.com', 'c-rest', 'pans and company|pans'],
  ['La Tagliatella', 'latagliatella.es', 'c-rest', 'tagliatella'],
  ['Muerde la Pasta', 'muerdelapasta.com', 'c-rest'],
  ['Lizarran', 'lizarran.es', 'c-rest'],
  ['Udon', 'udon.es', 'c-rest'],
  ['Honest Greens', 'honestgreens.com', 'c-rest'],
  ['Llaollao', 'llaollaoweb.com', 'c-rest'],
  ['Dunkin’', 'dunkin.es', 'c-rest', 'dunkin|dunkin donuts'],
  ['Granier', 'granier.es', 'c-rest', 'panes granier'],
  ['Santagloria', 'santagloria.com', 'c-rest'],
  ['Café', '', 'c-rest', 'cafeteria|cafe|bar|restaurante|tapas|cerveceria'],
  ['Glovo', 'glovoapp.com', 'c-rest'],
  ['Just Eat', 'just-eat.es', 'c-rest', 'justeat'],
  ['Uber Eats', 'ubereats.com', 'c-rest', 'ubereats'],
  ['Too Good To Go', 'toogoodtogo.com', 'c-super', 'toogoodtogo'],

  // ---- Combustible y transporte ----
  ['Repsol', 'repsol.es', 'c-combust', 'waylet'],
  ['Moeve (Cepsa)', 'moeveglobal.com', 'c-combust', 'cepsa|moeve'],
  ['BP', 'bp.com', 'c-combust'],
  ['Galp', 'galp.com', 'c-combust'],
  ['Shell', 'shell.es', 'c-combust'],
  ['Petronor', 'petronor.eus', 'c-combust'],
  ['Ballenoil', 'ballenoil.es', 'c-combust'],
  ['Plenoil', 'plenoil.es', 'c-combust'],
  ['Petroprix', 'petroprix.com', 'c-combust'],
  ['Carrefour Gasolinera', 'carrefour.es', 'c-combust', 'carrefour gasolinera|gasolinera carrefour'],
  ['Gasolinera', '', 'c-combust', 'gasolinera|gasolina|diesel|combustible'],
  ['Uber', 'uber.com', 'c-trans'],
  ['Cabify', 'cabify.com', 'c-trans'],
  ['Bolt', 'bolt.eu', 'c-trans', 'bolt eu', 'exact'],
  ['FreeNow', 'free-now.com', 'c-trans', 'free now'],
  ['Taxi', '', 'c-trans', 'taxi'],
  ['Renfe', 'renfe.com', 'c-trans', 'cercanias'],
  ['Iryo', 'iryo.eu', 'c-trans'],
  ['Ouigo', 'ouigo.com', 'c-trans'],
  ['Alsa', 'alsa.es', 'c-trans'],
  ['Metro de Madrid', 'metromadrid.es', 'c-trans', 'metro madrid|abono transporte|crtm|tarjeta transporte'],
  ['TMB', 'tmb.cat', 'c-trans', 'metro barcelona'],
  ['EMT', 'emtmadrid.es', 'c-trans', 'emt madrid'],
  ['BlaBlaCar', 'blablacar.es', 'c-trans'],
  ['Telpark', 'telpark.com', 'c-trans'],
  ['Empark', 'empark.com', 'c-trans'],
  ['Parking', '', 'c-trans', 'parking|aparcamiento|ora|ser madrid'],
  ['Zity', 'zity.eco', 'c-trans'],
  ['Free2Move', 'free2move.com', 'c-trans', 'share now'],
  ['Lime', 'li.me', 'c-trans', 'lime patinete', 'exact'],
  ['Cooltra', 'cooltra.com', 'c-trans'],
  ['Autopista', '', 'c-trans', 'peaje|autopista|via t|via-t'],
  ['ITV', '', 'c-trans', 'itv'],
  ['Norauto', 'norauto.es', 'c-trans'],
  ['Midas', 'midas.es', 'c-trans'],
  ['Feu Vert', 'feuvert.es', 'c-trans'],

  // ---- Viajes ----
  ['Iberia', 'iberia.com', 'c-viajes'],
  ['Vueling', 'vueling.com', 'c-viajes'],
  ['Ryanair', 'ryanair.com', 'c-viajes'],
  ['Air Europa', 'aireuropa.com', 'c-viajes'],
  ['easyJet', 'easyjet.com', 'c-viajes'],
  ['Volotea', 'volotea.com', 'c-viajes'],
  ['Binter', 'bintercanarias.com', 'c-viajes'],
  ['Booking', 'booking.com', 'c-viajes', 'booking com'],
  ['Airbnb', 'airbnb.es', 'c-viajes'],
  ['Expedia', 'expedia.es', 'c-viajes'],
  ['eDreams', 'edreams.es', 'c-viajes'],
  ['Trivago', 'trivago.es', 'c-viajes'],
  ['Skyscanner', 'skyscanner.es', 'c-viajes'],
  ['NH Hotels', 'nh-hotels.com', 'c-viajes', 'nh hotel'],
  ['Meliá', 'melia.com', 'c-viajes', 'melia'],
  ['Iberostar', 'iberostar.com', 'c-viajes'],
  ['Barceló', 'barcelo.com', 'c-viajes', 'barcelo'],
  ['Hertz', 'hertz.es', 'c-viajes'],
  ['Europcar', 'europcar.es', 'c-viajes'],
  ['Sixt', 'sixt.es', 'c-viajes'],
  ['Goldcar', 'goldcar.es', 'c-viajes'],
  ['Avis', 'avis.es', 'c-viajes'],
  ['Aena', 'aena.es', 'c-viajes'],

  // ---- Telefonía e internet ----
  ['Movistar', 'movistar.es', 'c-telef', 'telefonica'],
  ['Vodafone', 'vodafone.es', 'c-telef'],
  ['Orange', 'orange.es', 'c-telef'],
  ['Yoigo', 'yoigo.com', 'c-telef'],
  ['MásMóvil', 'masmovil.es', 'c-telef', 'masmovil|mas movil'],
  ['Digi', 'digimobil.es', 'c-telef', 'digi mobil|digimobil'],
  ['Pepephone', 'pepephone.com', 'c-telef'],
  ['Simyo', 'simyo.es', 'c-telef'],
  ['Lowi', 'lowi.es', 'c-telef'],
  ['O2', 'o2online.es', 'c-telef'],
  ['Jazztel', 'jazztel.com', 'c-telef'],
  ['Finetwork', 'finetwork.com', 'c-telef'],
  ['Avatel', 'avatel.es', 'c-telef'],
  ['Adamo', 'adamo.es', 'c-telef'],

  // ---- Suministros ----
  ['Iberdrola', 'iberdrola.es', 'c-sumin'],
  ['Endesa', 'endesa.com', 'c-sumin'],
  ['Naturgy', 'naturgy.es', 'c-sumin', 'gas natural'],
  ['TotalEnergies', 'totalenergies.es', 'c-sumin', 'total energies'],
  ['Holaluz', 'holaluz.com', 'c-sumin'],
  ['Octopus Energy', 'octopusenergy.es', 'c-sumin', 'octopus'],
  ['EDP', 'edpenergia.es', 'c-sumin'],
  ['Repsol Luz y Gas', 'repsol.es', 'c-sumin', 'repsol luz|repsol gas'],
  ['Som Energia', 'somenergia.coop', 'c-sumin'],
  ['Canal de Isabel II', 'canaldeisabelsegunda.es', 'c-sumin', 'canal isabel ii|canal de isabel'],
  ['Aigües de Barcelona', 'aiguesdebarcelona.cat', 'c-sumin', 'aigues de barcelona'],
  ['Aqualia', 'aqualia.com', 'c-sumin'],
  ['Emasesa', 'emasesa.com', 'c-sumin'],

  // ---- Suscripciones y servicios digitales ----
  ['Netflix', 'netflix.com', 'c-subs'],
  ['Spotify', 'spotify.com', 'c-subs'],
  ['Disney+', 'disneyplus.com', 'c-subs', 'disney plus|disney'],
  ['HBO Max', 'hbomax.com', 'c-subs', 'hbo|max hbo'],
  ['Prime Video', 'primevideo.com', 'c-subs', 'prime video|prime'],
  ['Apple TV+', 'tv.apple.com', 'c-subs', 'apple tv'],
  ['Apple Music', 'music.apple.com', 'c-subs'],
  ['iCloud+', 'icloud.com', 'c-subs', 'icloud'],
  ['Apple One', 'apple.com', 'c-subs'],
  ['YouTube Premium', 'youtube.com', 'c-subs', 'youtube'],
  ['Google One', 'one.google.com', 'c-subs'],
  ['DAZN', 'dazn.com', 'c-subs'],
  ['Movistar Plus+', 'movistarplus.es', 'c-subs', 'movistar plus'],
  ['Filmin', 'filmin.es', 'c-subs'],
  ['SkyShowtime', 'skyshowtime.com', 'c-subs'],
  ['Atresplayer', 'atresplayer.com', 'c-subs'],
  ['Crunchyroll', 'crunchyroll.com', 'c-subs'],
  ['Twitch', 'twitch.tv', 'c-subs'],
  ['Audible', 'audible.es', 'c-subs'],
  ['Kindle Unlimited', 'amazon.es', 'c-subs', 'kindle'],
  ['Storytel', 'storytel.com', 'c-subs'],
  ['Deezer', 'deezer.com', 'c-subs'],
  ['Tidal', 'tidal.com', 'c-subs'],
  ['Xbox Game Pass', 'xbox.com', 'c-subs', 'xbox|game pass'],
  ['PlayStation Plus', 'playstation.com', 'c-subs', 'playstation|ps plus|psn'],
  ['Nintendo', 'nintendo.es', 'c-subs', 'nintendo switch online'],
  ['Steam', 'steampowered.com', 'c-ocio'],
  ['ChatGPT', 'openai.com', 'c-subs', 'openai|chatgpt plus'],
  ['Claude', 'claude.ai', 'c-subs', 'anthropic'],
  ['Microsoft 365', 'microsoft365.com', 'c-subs', 'office 365|microsoft 365'],
  ['Adobe', 'adobe.com', 'c-subs', 'adobe creative cloud'],
  ['Canva', 'canva.com', 'c-subs'],
  ['Notion', 'notion.so', 'c-subs'],
  ['Dropbox', 'dropbox.com', 'c-subs'],
  ['1Password', '1password.com', 'c-subs'],
  ['NordVPN', 'nordvpn.com', 'c-subs'],
  ['Duolingo', 'duolingo.com', 'c-subs'],
  ['LinkedIn', 'linkedin.com', 'c-subs'],
  ['Patreon', 'patreon.com', 'c-subs'],
  ['Tinder', 'tinder.com', 'c-subs'],
  ['Strava', 'strava.com', 'c-subs'],
  ['El País', 'elpais.com', 'c-subs', 'el pais'],
  ['El Mundo', 'elmundo.es', 'c-subs'],
  ['Expansión', 'expansion.com', 'c-subs', 'expansion'],
  ['The Economist', 'economist.com', 'c-subs'],
  ['Uber One', 'uber.com', 'c-subs'],
  ['Glovo Prime', 'glovoapp.com', 'c-subs'],
  ['Amazon Prime', 'amazon.es', 'c-subs'],

  // ---- Deporte ----
  ['Basic-Fit', 'basic-fit.com', 'c-deporte', 'basic fit|basicfit'],
  ['McFit', 'mcfit.com', 'c-deporte'],
  ['Anytime Fitness', 'anytimefitness.es', 'c-deporte'],
  ['VivaGym', 'vivagym.es', 'c-deporte', 'viva gym'],
  ['Altafit', 'altafit.es', 'c-deporte'],
  ['Synergym', 'synergym.es', 'c-deporte'],
  ['Holmes Place', 'holmesplace.es', 'c-deporte'],
  ['GO fit', 'go-fit.es', 'c-deporte', 'gofit'],
  ['DIR', 'dir.cat', 'c-deporte', 'club dir', 'exact'],
  ['Metropolitan', 'clubmetropolitan.net', 'c-deporte'],
  ['Gimnasio', '', 'c-deporte', 'gimnasio|gym|padel|crossfit'],

  // ---- Ocio y cultura ----
  ['Cinesa', 'cinesa.es', 'c-ocio'],
  ['Yelmo Cines', 'yelmocines.es', 'c-ocio', 'yelmo'],
  ['Kinépolis', 'kinepolis.es', 'c-ocio', 'kinepolis'],
  ['Cine', '', 'c-ocio', 'cine|cines'],
  ['Ticketmaster', 'ticketmaster.es', 'c-ocio'],
  ['Entradas.com', 'entradas.com', 'c-ocio'],
  ['Fever', 'feverup.com', 'c-ocio'],
  ['Eventbrite', 'eventbrite.es', 'c-ocio'],
  ['Loterías', 'loteriasyapuestas.es', 'c-ocio', 'loterias|loteria|primitiva|euromillones|bonoloto'],
  ['ONCE', 'juegosonce.es', 'c-ocio', 'cupon once', 'exact'],
  ['Casa del Libro', 'casadellibro.com', 'c-ocio'],
  ['Juguettos', 'juguettos.com', 'c-regalos'],
  ['Smyths Toys', 'smythstoys.com', 'c-regalos', 'smyths'],
  ['Toys"R"Us', 'toysrus.es', 'c-regalos', 'toys r us'],
  ['LEGO', 'lego.com', 'c-regalos'],
  ['PortAventura', 'portaventuraworld.com', 'c-ocio', 'port aventura'],
  ['Parque Warner', 'parquewarner.com', 'c-ocio'],

  // ---- Mascotas ----
  ['Tiendanimal', 'tiendanimal.es', 'c-mascotas'],
  ['Kiwoko', 'kiwoko.com', 'c-mascotas'],
  ['Zooplus', 'zooplus.es', 'c-mascotas'],
  ['Veterinario', '', 'c-mascotas', 'veterinario|clinica veterinaria'],

  // ---- Educación ----
  ['Udemy', 'udemy.com', 'c-formac'],
  ['Coursera', 'coursera.org', 'c-formac'],
  ['Platzi', 'platzi.com', 'c-formac'],
  ['Domestika', 'domestika.org', 'c-formac'],
  ['UNED', 'uned.es', 'c-formac'],
  ['UOC', 'uoc.edu', 'c-formac'],
  ['UNIR', 'unir.net', 'c-formac'],

  // ---- Seguros ----
  ['Mapfre', 'mapfre.es', 'c-seguros'],
  ['Mutua Madrileña', 'mutua.es', 'c-seguros', 'mutua madrilena|mutua'],
  ['Línea Directa', 'lineadirecta.com', 'c-seguros', 'linea directa'],
  ['AXA', 'axa.es', 'c-seguros'],
  ['Allianz', 'allianz.es', 'c-seguros'],
  ['Generali', 'generali.es', 'c-seguros'],
  ['Zurich', 'zurich.es', 'c-seguros'],
  ['Verti', 'verti.es', 'c-seguros'],
  ['Pelayo', 'pelayo.com', 'c-seguros'],
  ['Reale', 'reale.es', 'c-seguros'],
  ['Santalucía', 'santalucia.es', 'c-seguros', 'santalucia'],
  ['Caser', 'caser.es', 'c-seguros'],
  ['Ocaso', 'ocaso.es', 'c-seguros'],

  // ---- Bancos, pagos e inversión ----
  ['BBVA', 'bbva.es', 'c-bancos'],
  ['Santander', 'bancosantander.es', 'c-bancos', 'banco santander'],
  ['CaixaBank', 'caixabank.es', 'c-bancos', 'la caixa|caixa'],
  ['Sabadell', 'bancsabadell.com', 'c-bancos', 'banco sabadell'],
  ['Bankinter', 'bankinter.com', 'c-bancos'],
  ['ING', 'ing.es', 'c-bancos', 'ing direct'],
  ['Openbank', 'openbank.es', 'c-bancos'],
  ['Revolut', 'revolut.com', 'c-bancos'],
  ['N26', 'n26.com', 'c-bancos'],
  ['Unicaja', 'unicajabanco.es', 'c-bancos'],
  ['Kutxabank', 'kutxabank.es', 'c-bancos'],
  ['Abanca', 'abanca.com', 'c-bancos'],
  ['Ibercaja', 'ibercaja.es', 'c-bancos'],
  ['Cajamar', 'cajamar.es', 'c-bancos'],
  ['MyInvestor', 'myinvestor.es', 'c-bancos'],
  ['Trade Republic', 'traderepublic.com', 'c-bancos'],
  ['DEGIRO', 'degiro.es', 'c-bancos'],
  ['Interactive Brokers', 'interactivebrokers.com', 'c-bancos', 'ibkr'],
  ['eToro', 'etoro.com', 'c-bancos'],
  ['Indexa Capital', 'indexacapital.com', 'c-bancos', 'indexa'],
  ['Binance', 'binance.com', 'c-bancos'],
  ['Coinbase', 'coinbase.com', 'c-bancos'],
  ['Bizum', 'bizum.es', 'c-otros-g'],
  ['PayPal', 'paypal.com', 'c-otros-g'],
  ['Comisión bancaria', '', 'c-bancos', 'comision|comision mantenimiento|comisiones'],

  // ---- Impuestos y administración ----
  ['Agencia Tributaria', 'agenciatributaria.gob.es', 'c-impuestos', 'hacienda|aeat|irpf|iva'],
  ['Seguridad Social', 'seg-social.es', 'c-impuestos', 'autonomos|cuota autonomos|tgss'],
  ['DGT', 'dgt.es', 'c-impuestos', 'multa|trafico'],
  ['IBI', '', 'c-impuestos', 'ibi|impuesto circulacion|ivtm|basuras'],

  // ---- Vivienda ----
  ['Alquiler', '', 'c-casa', 'alquiler|renta piso|hipoteca|comunidad|comunidad de vecinos'],
  ['Idealista', 'idealista.com', 'c-casa'],
  ['Fotocasa', 'fotocasa.es', 'c-casa'],
];

// Tickers → dominio para mostrar el logo de la empresa en Inversiones
export const TICKER_DOMAINS = {
  AAPL: 'apple.com', MSFT: 'microsoft.com', GOOGL: 'abc.xyz', GOOG: 'abc.xyz', AMZN: 'amazon.com', META: 'meta.com',
  NVDA: 'nvidia.com', TSLA: 'tesla.com', 'BRK-B': 'berkshirehathaway.com', 'BRK-A': 'berkshirehathaway.com', V: 'visa.com',
  MA: 'mastercard.com', JPM: 'jpmorganchase.com', BAC: 'bankofamerica.com', MS: 'morganstanley.com', GS: 'goldmansachs.com',
  AXP: 'americanexpress.com', PYPL: 'paypal.com', COST: 'costco.com', WMT: 'walmart.com', HD: 'homedepot.com',
  KO: 'coca-cola.com', PEP: 'pepsico.com', MCD: 'mcdonalds.com', SBUX: 'starbucks.com', NKE: 'nike.com',
  DIS: 'disney.com', NFLX: 'netflix.com', SPOT: 'spotify.com', ADBE: 'adobe.com', CRM: 'salesforce.com',
  ORCL: 'oracle.com', IBM: 'ibm.com', INTC: 'intel.com', AMD: 'amd.com', AVGO: 'broadcom.com', QCOM: 'qualcomm.com',
  TXN: 'ti.com', MU: 'micron.com', ASML: 'asml.com', 'ASML.AS': 'asml.com', TSM: 'tsmc.com', '2330.TW': 'tsmc.com',
  SHOP: 'shopify.com', UBER: 'uber.com', ABNB: 'airbnb.com', BKNG: 'booking.com', PLTR: 'palantir.com',
  CRWD: 'crowdstrike.com', SNOW: 'snowflake.com', NOW: 'servicenow.com', INTU: 'intuit.com', ANET: 'arista.com',
  MELI: 'mercadolibre.com', SE: 'sea.com', BABA: 'alibaba.com', '9988.HK': 'alibaba.com', '0700.HK': 'tencent.com',
  JD: 'jd.com', PDD: 'pddholdings.com', LLY: 'lilly.com', NVO: 'novonordisk.com', 'NOVO-B.CO': 'novonordisk.com',
  UNH: 'unitedhealthgroup.com', JNJ: 'jnj.com', PFE: 'pfizer.com', MRK: 'merck.com', ABBV: 'abbvie.com',
  ISRG: 'intuitive.com', TMO: 'thermofisher.com', CVS: 'cvshealth.com', MCK: 'mckesson.com',
  XOM: 'exxonmobil.com', CVX: 'chevron.com', CAT: 'caterpillar.com', DE: 'deere.com', BA: 'boeing.com',
  GE: 'ge.com', HON: 'honeywell.com', UPS: 'ups.com', WM: 'wm.com', TDG: 'transdigm.com', MSCI: 'msci.com',
  SPGI: 'spglobal.com', MCO: 'moodys.com', CME: 'cmegroup.com', ICE: 'ice.com', FICO: 'fico.com', ADSK: 'autodesk.com',
  SNPS: 'synopsys.com', CDNS: 'cadence.com', VRSN: 'verisign.com', MSI: 'motorolasolutions.com', ORLY: 'oreillyauto.com',
  AZO: 'autozone.com', CMG: 'chipotle.com', LULU: 'lululemon.com', ULTA: 'ulta.com', ELF: 'elfcosmetics.com',
  CELH: 'celsius.com', HSY: 'thehersheycompany.com', STZ: 'cbrands.com', CPRT: 'copart.com', CSGP: 'costargroup.com',
  FI: 'fiserv.com', GPN: 'globalpayments.com', TTD: 'thetradedesk.com', HUBS: 'hubspot.com', DDOG: 'datadoghq.com',
  DOCU: 'docusign.com', ZM: 'zoom.us', ROKU: 'roku.com', RBLX: 'roblox.com', U: 'unity.com', COIN: 'coinbase.com',
  MSTR: 'strategy.com', SMCI: 'supermicro.com', DELL: 'dell.com', HPQ: 'hp.com', ARM: 'arm.com', ON: 'onsemi.com',
  'CSU.TO': 'csisoftware.com', 'SHOP.TO': 'shopify.com', RY: 'rbc.com', 'RY.TO': 'rbc.com', CP: 'cpkcr.com',
  QSR: 'rbi.com', OTEX: 'opentext.com', 'MTY.TO': 'mtygroup.com', 'TVK.TO': 'terravestindustries.com',
  // España (IBEX 35)
  'SAN.MC': 'santander.com', 'BBVA.MC': 'bbva.com', 'ITX.MC': 'inditex.com', 'IBE.MC': 'iberdrola.com',
  'TEF.MC': 'telefonica.com', 'REP.MC': 'repsol.com', 'CABK.MC': 'caixabank.com', 'SAB.MC': 'bancsabadell.com',
  'BKT.MC': 'bankinter.com', 'AENA.MC': 'aena.es', 'AMS.MC': 'amadeus.com', 'FER.MC': 'ferrovial.com',
  'ACS.MC': 'grupoacs.com', 'ANA.MC': 'acciona.com', 'ELE.MC': 'endesa.com', 'NTGY.MC': 'naturgy.com',
  'RED.MC': 'ree.es', 'ENG.MC': 'enagas.es', 'GRF.MC': 'grifols.com', 'IAG.MC': 'iairgroup.com',
  'MAP.MC': 'mapfre.com', 'MTS.MC': 'arcelormittal.com', 'ACX.MC': 'acerinox.com', 'CLNX.MC': 'cellnex.com',
  'IDR.MC': 'indracompany.com', 'LOG.MC': 'logista.com', 'MRL.MC': 'merlinprop.com', 'COL.MC': 'inmocolonial.com',
  'ROVI.MC': 'rovi.es', 'SCYR.MC': 'sacyr.com', 'UNI.MC': 'unicajabanco.es', 'FDR.MC': 'fluidra.com',
  'PUIG.MC': 'puig.com', 'VID.MC': 'vidrala.com', 'SLR.MC': 'solarpack.es', 'ANE.MC': 'acciona-energia.com',
  // Europa
  'MC.PA': 'lvmh.com', 'RMS.PA': 'hermes.com', 'OR.PA': 'loreal.com', 'KER.PA': 'kering.com', 'AIR.PA': 'airbus.com',
  'SU.PA': 'se.com', 'RACE.MI': 'ferrari.com', RACE: 'ferrari.com', 'SAP.DE': 'sap.com', SAP: 'sap.com',
  'NESN.SW': 'nestle.com', 'ADYEN.AS': 'adyen.com', 'MONC.MI': 'monclergroup.com', 'BC.MI': 'brunellocucinelli.com',
  'EVO.ST': 'evolution.com', 'INVE-B.ST': 'investorab.com', 'DIM.PA': 'sartorius.com', 'ERF.PA': 'eurofins.com',
  'VRLA.PA': 'verallia.com', 'TEP.PA': 'tp.com', 'FDJ.PA': 'fdjunited.com', 'DGE.L': 'diageo.com',
  'RR.L': 'rolls-royce.com', 'BRBY.L': 'burberryplc.com', 'ZEG.L': 'zegona.com', 'EQNR.OL': 'equinor.com',
  'STLAM.MI': 'stellantis.com', STLA: 'stellantis.com', 'DNP.WA': 'grupadino.pl', 'ZAB.WA': 'zabka.pl',
  'JMT.LS': 'jeronimomartins.com', 'NA9.DE': 'nagarro.com', 'AOF.DE': 'atoss.com', 'BFIT.AS': 'basic-fit.com',
  PBR: 'petrobras.com.br', VALE: 'vale.com', ERJ: 'embraer.com', YPF: 'ypf.com',
  // ETFs y cripto
  SPY: 'ssga.com', VOO: 'vanguard.com', VWCE: 'vanguard.com', 'VWCE.DE': 'vanguard.com', QQQ: 'invesco.com',
  'IWDA.AS': 'ishares.com', 'EUNL.DE': 'ishares.com', 'CSPX.L': 'ishares.com', 'SXR8.DE': 'ishares.com',
  'BTC-EUR': 'bitcoin.org', 'BTC-USD': 'bitcoin.org', 'ETH-EUR': 'ethereum.org', 'ETH-USD': 'ethereum.org',
  'SOL-EUR': 'solana.com', 'SOL-USD': 'solana.com', 'ADA-EUR': 'cardano.org', 'XRP-EUR': 'xrpl.org', 'DOGE-EUR': 'dogecoin.com',
  '^GSPC': 'spglobal.com',
};

// ---------------------------------------------------------------------------

export function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' & ')
    .replace(/[^a-z0-9&%]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const slug = (s) => normalize(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const MERCHANTS = RAW.map(([name, domain, category, aliases = '', opts = '']) => {
  const al = [name, ...aliases.split('|')].map(normalize).filter(Boolean);
  return { id: slug(name), name, domain, category, aliases: [...new Set(al)], exact: opts.includes('exact'), generic: !domain };
});

const BY_ID = Object.fromEntries(MERCHANTS.map((m) => [m.id, m]));

export function merchantById(id) {
  return id ? BY_ID[id] || null : null;
}

// Índice de alias: primero las marcas (antes que palabras genéricas como
// "gasolina") y, dentro de ellas, de más largo a más corto ("zara home" > "zara")
const INDEX = MERCHANTS.flatMap((m) => m.aliases.map((a) => ({ a, m })))
  .sort((x, y) => Number(x.m.generic) - Number(y.m.generic) || y.a.length - x.a.length);

/**
 * Detecta el comercio en un concepto libre o texto de extracto bancario:
 * "COMPRA TARJ. MERCADONA S.A." → Mercadona.
 */
export function matchMerchant(text) {
  const t = normalize(text);
  if (!t) return null;
  const padded = ` ${t} `;
  for (const { a, m } of INDEX) {
    if (m.exact) {
      if (t === a) return m;
      // Los alias compuestos de marcas "exactas" sí se buscan dentro del texto
      if (a.includes(' ') && padded.includes(` ${a} `)) return m;
      continue;
    }
    if (padded.includes(` ${a} `)) return m;
  }
  return null;
}

/** Sugerencias para el autocompletado (solo marcas con logo). */
export function searchMerchants(q, limit = 6) {
  const t = normalize(q);
  if (t.length < 2) return [];
  const scored = [];
  for (const m of MERCHANTS) {
    if (m.generic) continue;
    let best = 99;
    for (const a of m.aliases) {
      if (a === t) best = Math.min(best, 0);
      else if (a.startsWith(t)) best = Math.min(best, 1);
      else if (a.split(' ').some((w) => w.startsWith(t))) best = Math.min(best, 2);
      else if (t.length >= 3 && a.includes(t)) best = Math.min(best, 3);
    }
    if (best < 99) scored.push([best, m.name.length, m]);
  }
  return scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, limit).map((x) => x[2]);
}

/** Dominio para el logo de una posición de inversión. */
export function domainForAsset({ symbol, name }) {
  const s = String(symbol || '').toUpperCase();
  if (s && TICKER_DOMAINS[s]) return TICKER_DOMAINS[s];
  const m = matchMerchant(name);
  return m?.domain || null;
}

/** Comercio de un movimiento/recurrente: el elegido o el detectado en el texto. */
export function merchantOf(item) {
  return merchantById(item?.merchant) || matchMerchant(item?.note ?? item?.name);
}
