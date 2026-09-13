import { db } from '../db/index.js';
import { geographicStates, geographicMunicipalities } from '../db/schema.js';
import { and, eq, sql } from 'drizzle-orm';
import { haversineDistance } from '../lib/geo.js';

const MUNICIPALITY_ALIASES: Record<string, string> = {
  // São Paulo aliases
  'capital': 'sao paulo',
  's paulo': 'sao paulo',
  's. paulo': 'sao paulo',
  's bernardo do campo': 'sao bernardo do campo',
  's. bernardo do campo': 'sao bernardo do campo',
  's caetano do sul': 'sao caetano do sul',
  's. caetano do sul': 'sao caetano do sul',
  's jose dos campos': 'sao jose dos campos',
  's. jose dos campos': 'sao jose dos campos',
  's jose do rio preto': 'sao jose do rio preto',
  's. jose do rio preto': 'sao jose do rio preto',
  's roque': 'sao roque',
  's. roque': 'sao roque',
  's vicente': 'sao vicente',
  's. vicente': 'sao vicente',
  's carlos': 'sao carlos',
  's. carlos': 'sao carlos',
  's joao da boa vista': 'sao joao da boa vista',
  's. joao da boa vista': 'sao joao da boa vista',
  's sebastiao': 'sao sebastiao',
  's. sebastiao': 'sao sebastiao',
  'embu': 'embu das artes',
  'florinia': 'florinea',
  'moji mirim': 'mogi mirim',
  'moji guacu': 'mogi guacu',
  'santa barbara d oeste': 'santa barbara doeste',
  'santa barbara doeste': 'santa barbara doeste',
  'santana de parnaiba': 'santana de parnaiba',
  'biritiba mirim': 'biritiba mirim',
  // Rio de Janeiro aliases
  'rio de janeiro': 'rio de janeiro',
  's goncalo': 'sao goncalo',
  's. goncalo': 'sao goncalo',
  's joao de meriti': 'sao joao de meriti',
  's. joao de meriti': 'sao joao de meriti',
  's fidelis': 'sao fidelis',
  's. fidelis': 'sao fidelis',
  's francisco de itabapoana': 'sao francisco de itabapoana',
  's. francisco de itabapoana': 'sao francisco de itabapoana',
  's pedro da aldeia': 'sao pedro da aldeia',
  's. pedro da aldeia': 'sao pedro da aldeia',
  's jose de uba': 'sao jose de uba',
  's. jose de uba': 'sao jose de uba',
  's jose do vale do rio preto': 'sao jose do vale do rio preto',
  's. jose do vale do rio preto': 'sao jose do vale do rio preto',
  's antonio de padua': 'sao antonio de padua',
  's. antonio de padua': 'sao antonio de padua',
  'buzios': 'armacao dos buzios',
  'armacao de buzios': 'armacao dos buzios',
  'parati': 'paraty',
  'trajano de morais': 'trajano de moraes',
  'eng paulo de frontin': 'engenheiro paulo de frontin',
  'eng. paulo de frontin': 'engenheiro paulo de frontin',
  'paty do alferes': 'paty do alferes',
  // Minas Gerais aliases
  'belo horizonte': 'belo horizonte',
  'bh': 'belo horizonte',
  's joao del rei': 'sao joao del rei',
  's. joao del rei': 'sao joao del rei',
  'sao joao del-rei': 'sao joao del rei',
  'sao joao d el rei': 'sao joao del rei',
  's sebastiao do paraiso': 'sao sebastiao do paraiso',
  's. sebastiao do paraiso': 'sao sebastiao do paraiso',
  's lourenco': 'sao lourenco',
  's. lourenco': 'sao lourenco',
  'brazopolis': 'brasopolis',
  'dona euzebia': 'dona eusebia',
  'gouvea': 'gouveia',
  'itabirinha de mantena': 'itabirinha',
  'passa-vinte': 'passa vinte',
  'pingo d agua': 'pingo-d agua',
  'sao joao das missoes': 'sao joao das missoes',
  // Rio Grande do Sul aliases
  'porto alegre': 'porto alegre',
  'poa': 'porto alegre',
  's leopoldo': 'sao leopoldo',
  's. leopoldo': 'sao leopoldo',
  's gabriel': 'sao gabriel',
  's. gabriel': 'sao gabriel',
  's borja': 'sao borja',
  's. borja': 'sao borja',
  's luiz gonzaga': 'sao luiz gonzaga',
  's. luiz gonzaga': 'sao luiz gonzaga',
  'sao luiz gonzaga': 'sao luiz gonzaga',
  's lourenco do sul': 'sao lourenco do sul',
  's. lourenco do sul': 'sao lourenco do sul',
  's vicente do sul': 'sao vicente do sul',
  's. vicente do sul': 'sao vicente do sul',
  's jerônimo': 'sao jeronimo',
  's. jeronimo': 'sao jeronimo',
  's marques': 'sao marcos',
  's. marcos': 'sao marcos',
  'santana do livramento': 'sant ana do livramento',
  'sant\'ana do livramento': 'sant ana do livramento',
  'livramento': 'sant ana do livramento',
  'santo antonio da patrulha': 'santo antonio da patrulha',
  's. antonio da patrulha': 'santo antonio da patrulha',
  'entre-ijuis': 'entre ijuis',
  'eugênio de castro': 'eugenio de castro',
  // Paraná aliases
  'cwb': 'curitiba',
  's jose dos pinhais': 'sao jose dos pinhais',
  's. jose dos pinhais': 'sao jose dos pinhais',
  'foz': 'foz do iguacu',
  'foz do iguassu': 'foz do iguacu',
  'pg': 'ponta grossa',
  's mateus do sul': 'sao mateus do sul',
  's. mateus do sul': 'sao mateus do sul',
  's jorge d\'oeste': 'sao jorge d oeste',
  's. jorge d\'oeste': 'sao jorge d oeste',
  'sto antonio da platina': 'santo antonio da platina',
  's. antonio da platina': 'santo antonio da platina',
  'sao miguel do iguacu': 'sao miguel do iguacu',
  's. miguel do iguacu': 'sao miguel do iguacu',
  // Santa Catarina aliases
  'floripa': 'florianopolis',
  'florianópolis': 'florianopolis',
  'bc': 'balneario camboriu',
  'balneário camboriú': 'balneario camboriu',
  'sao jose': 'sao jose',
  's jose': 'sao jose',
  's. jose': 'sao jose',
  'sao bento': 'sao bento do sul',
  's bento do sul': 'sao bento do sul',
  's. bento do sul': 'sao bento do sul',
  'sao francisco': 'sao francisco do sul',
  's francisco do sul': 'sao francisco do sul',
  's. francisco do sul': 'sao francisco do sul',
  'sao joao batista': 'sao joao batista',
  's joao batista': 'sao joao batista',
  's. joao batista': 'sao joao batista',
  'sto amaro da imperatriz': 'santo amaro da imperatriz',
  's amaro da imperatriz': 'santo amaro da imperatriz',
  's. amaro da imperatriz': 'santo amaro da imperatriz',
  // Bahia aliases
  'ssa': 'salvador',
  'sao salvador': 'salvador',
  'sao salvador da bahia': 'salvador',
  'feira': 'feira de santana',
  'fsa': 'feira de santana',
  'conquista': 'vitoria da conquista',
  'vca': 'vitoria da conquista',
  'lauro': 'lauro de freitas',
  'sto antonio de jesus': 'santo antonio de jesus',
  's antonio de jesus': 'santo antonio de jesus',
  's. antonio de jesus': 'santo antonio de jesus',
  'sto amaro': 'santo amaro',
  's amaro': 'santo amaro',
  's. amaro': 'santo amaro',
  's francisco do conde': 'sao francisco do conde',
  's. francisco do conde': 'sao francisco do conde',
  'sao sebastiao do passe': 'sao sebastiao do passe',
  's sebastiao do passe': 'sao sebastiao do passe',
  's. sebastiao do passe': 'sao sebastiao do passe',
  'sao goncalo dos campos': 'sao goncalo dos campos',
  's goncalo dos campos': 'sao goncalo dos campos',
  's. goncalo dos campos': 'sao goncalo dos campos',
  // Pernambuco aliases
  'rec': 'recife',
  'jaboatao': 'jaboatao dos guararapes',
  'jaboatão': 'jaboatao dos guararapes',
  'cabo': 'cabo de santo agostinho',
  'cabo de s agostinho': 'cabo de santo agostinho',
  'cabo de s. agostinho': 'cabo de santo agostinho',
  'cabo de sto agostinho': 'cabo de santo agostinho',
  's lourenco da mata': 'sao lourenco da mata',
  's. lourenco da mata': 'sao lourenco da mata',
  'vitoria de sto antao': 'vitoria de santo antao',
  'vitoria de s antao': 'vitoria de santo antao',
  'vitoria de s. antao': 'vitoria de santo antao',
  'sta cruz do capibaribe': 'santa cruz do capibaribe',
  's cruz do capibaribe': 'santa cruz do capibaribe',
  's. cruz do capibaribe': 'santa cruz do capibaribe',
  'sta maria da boa vista': 'santa maria da boa vista',
  's maria da boa vista': 'santa maria da boa vista',
  's. maria da boa vista': 'santa maria da boa vista',
  'sao jose do egito': 'sao jose do egito',
  's jose do egito': 'sao jose do egito',
  's. jose do egito': 'sao jose do egito',
  'sao jose do belmonte': 'sao jose do belmonte',
  's jose do belmonte': 'sao jose do belmonte',
  's. jose do belmonte': 'sao jose do belmonte',
  'sao jose da coroa grande': 'sao jose da coroa grande',
  's jose da coroa grande': 'sao jose da coroa grande',
  's. jose da coroa grande': 'sao jose da coroa grande',
  'sao joaquim do monte': 'sao joaquim do monte',
  's joaquim do monte': 'sao joaquim do monte',
  's. joaquim do monte': 'sao joaquim do monte',
  'sao bento do una': 'sao bento do una',
  's bento do una': 'sao bento do una',
  's. bento do una': 'sao bento do una',
  'sao caetano': 'sao caetano',
  's caetano': 'sao caetano',
  's. caetano': 'sao caetano',
  'sao vicente ferrer': 'sao vicente ferrer',
  's vicente ferrer': 'sao vicente ferrer',
  's. vicente ferrer': 'sao vicente ferrer',
  'belem de sao francisco': 'belem do sao francisco',
  'ilha de fernando de noronha': 'fernando de noronha',
  'distrito estadual de fernando de noronha': 'fernando de noronha',
  // Ceará aliases
  'fortal': 'fortaleza',
  'juazeiro do norte': 'juazeiro do norte',
  'juazeiro n': 'juazeiro do norte',
  'sao goncalo do amarante': 'sao goncalo do amarante',
  's goncalo do amarante': 'sao goncalo do amarante',
  's. goncalo do amarante': 'sao goncalo do amarante',
  'sao benedito': 'sao benedito',
  's benedito': 'sao benedito',
  's. benedito': 'sao benedito',
  'sao joao do jaguaribe': 'sao joao do jaguaribe',
  's joao do jaguaribe': 'sao joao do jaguaribe',
  's. joao do jaguaribe': 'sao joao do jaguaribe',
  'santa quiteria': 'santa quiteria',
  'sta quiteria': 'santa quiteria',
  's. quiteria': 'santa quiteria',
  'santana do acarau': 'santana do acarau',
  'sta ana do acarau': 'santana do acarau',
  'santana do cariri': 'santana do cariri',
  'sta ana do cariri': 'santana do cariri',
  'limoeiro': 'limoeiro do norte',
  // Goiás aliases
  'gyn': 'goiania',
  'aparecida': 'aparecida de goiania',
  'ap de goiania': 'aparecida de goiania',
  'ap. de goiania': 'aparecida de goiania',
  'aparecida de gyn': 'aparecida de goiania',
  'aguas lindas': 'aguas lindas de goias',
  'aguas lindas de go': 'aguas lindas de goias',
  'valparaiso': 'valparaiso de goias',
  'valparaiso de go': 'valparaiso de goias',
  'sen canedo': 'senador canedo',
  'sen. canedo': 'senador canedo',
  'planaltina de goias': 'planaltina',
  'planaltina de go': 'planaltina',
  'sto antonio do descoberto': 'santo antonio do descoberto',
  's antonio do descoberto': 'santo antonio do descoberto',
  's. antonio do descoberto': 'santo antonio do descoberto',
  'sao luis de montes belos': 'sao luis de montes belos',
  's luis de montes belos': 'sao luis de montes belos',
  's. luis de montes belos': 'sao luis de montes belos',
  'sta helena de goias': 'santa helena de goias',
  'sta helena de go': 'santa helena de goias',
  'sao miguel do araguaia': 'sao miguel do araguaia',
  's miguel do araguaia': 'sao miguel do araguaia',
  's. miguel do araguaia': 'sao miguel do araguaia',
  'palmeiras de go': 'palmeiras de goias',
  // Distrito Federal (DF) aliases e Regiões Administrativas
  'bsb': 'brasilia',
  'plano piloto': 'brasilia',
  'distrito federal': 'brasilia',
  'df': 'brasilia',
  'ra i': 'brasilia',
  'ra 1': 'brasilia',
  'ra i plano piloto': 'brasilia',
  'ra ix ceilandia': 'brasilia',
  'ra iii taguatinga': 'brasilia',
  'ra xii samambaia': 'brasilia',
  'ra ii gama': 'brasilia',
  'ra v sobradinho': 'brasilia',
  'ra vi planaltina': 'brasilia',
  'ra vii paranoa': 'brasilia',
  'ra viii nucleo bandeirante': 'brasilia',
  'ra x guara': 'brasilia',
  'ra xi cruzeiro': 'brasilia',
  'ra xiii santa maria': 'brasilia',
  'ra xiv sao sebastiao': 'brasilia',
  'ra xv recanto das emas': 'brasilia',
  'ra xvi lago sul': 'brasilia',
  'ra xvii riacho fundo': 'brasilia',
  'ra xviii lago norte': 'brasilia',
  'ra xix candangolandia': 'brasilia',
  'ra xx aguas claras': 'brasilia',
  'ra xxi riacho fundo ii': 'brasilia',
  'ra xxii sudoeste octogonal': 'brasilia',
  'ra xxiii varjao': 'brasilia',
  'ra xxiv park way': 'brasilia',
  'ra xxv scia estrutural': 'brasilia',
  'ra xxvi sobradinho ii': 'brasilia',
  'ra xxvii jardim botanico': 'brasilia',
  'ra xxviii itapoa': 'brasilia',
  'ra xxix sia': 'brasilia',
  'ra xxx vicente pires': 'brasilia',
  'ra xxxi fercal': 'brasilia',
  'ra xxxii sol nascente por do sol': 'brasilia',
  'ra xxxiii arniqueira': 'brasilia',
  'ra xxxiv arapoanga': 'brasilia',
  'ra xxxv agua quente': 'brasilia',
  // Espírito Santo (ES) aliases
  'vix': 'vitoria',
  'vv': 'vila velha',
  'cachoeiro': 'cachoeiro de itapemirim',
  'cachoeiro itapemirim': 'cachoeiro de itapemirim',
  'sao mateus': 'sao mateus',
  's mateus': 'sao mateus',
  's. mateus': 'sao mateus',
  'sao gabriel da palha': 'sao gabriel da palha',
  's gabriel da palha': 'sao gabriel da palha',
  's. gabriel da palha': 'sao gabriel da palha',
  'sao jose do calcado': 'sao jose do calcado',
  's jose do calcado': 'sao jose do calcado',
  's. jose do calcado': 'sao jose do calcado',
  'sao roque do canaa': 'sao roque do canaa',
  's roque do canaa': 'sao roque do canaa',
  's. roque do canaa': 'sao roque do canaa',
  'sao domingos do norte': 'sao domingos do norte',
  's domingos do norte': 'sao domingos do norte',
  's. domingos do norte': 'sao domingos do norte',
  'sta maria de jetiba': 'santa maria de jetiba',
  'sta teresa': 'santa teresa',
  'sta leopoldina': 'santa leopoldina',
  'gov lindenberg': 'governador lindenberg',
  'gov. lindenberg': 'governador lindenberg',
  // Pará (PA) aliases
  'belem do para': 'belem',
  'sta izabel do para': 'santa izabel do para',
  's izabel do para': 'santa izabel do para',
  's. izabel do para': 'santa izabel do para',
  'santa isabel do para': 'santa izabel do para',
  'sta isabel do para': 'santa izabel do para',
  'sta barbara do para': 'santa barbara do para',
  's barbara do para': 'santa barbara do para',
  's. barbara do para': 'santa barbara do para',
  'santa barbara do para': 'santa barbara do para',
  'sao felix do xingu': 'sao felix do xingu',
  's felix do xingu': 'sao felix do xingu',
  's. felix do xingu': 'sao felix do xingu',
  'sao domingos do araguaia': 'sao domingos do araguaia',
  's domingos do araguaia': 'sao domingos do araguaia',
  'sao domingos do capim': 'sao domingos do capim',
  's domingos do capim': 'sao domingos do capim',
  'sao francisco do para': 'sao francisco do para',
  's francisco do para': 'sao francisco do para',
  'sao geraldo do araguaia': 'sao geraldo do araguaia',
  's geraldo do araguaia': 'sao geraldo do araguaia',
  'sao joao da ponta': 'sao joao da ponta',
  's joao da ponta': 'sao joao da ponta',
  'sao joao de pirabas': 'sao joao de pirabas',
  's joao de pirabas': 'sao joao de pirabas',
  'sao joao do araguaia': 'sao joao do araguaia',
  's joao do araguaia': 'sao joao do araguaia',
  'sao miguel do guama': 'sao miguel do guama',
  's miguel do guama': 'sao miguel do guama',
  'sao sebastiao da boa vista': 'sao sebastiao da boa vista',
  's sebastiao da boa vista': 'sao sebastiao da boa vista',
  'santarem': 'santarem',
  'santarem novo': 'santarem novo',
  'eldorado dos carajas': 'eldorado do carajas',
  'eldorado do carajas': 'eldorado do carajas',
  'capanema': 'capanema',
  'tome acu': 'tome-acu',
  'tome-acu': 'tome-acu',
  'igarape miri': 'igarape-miri',
  'igarape-miri': 'igarape-miri',
  'igarape acu': 'igarape-acu',
  'igarape-acu': 'igarape-acu',
  'mimoso': 'mimoso do sul',
  'pres kennedy': 'presidente kennedy',
  'pres. kennedy': 'presidente kennedy',
  'itaguacu': 'itaguacu',
  // Amazonas (AM) aliases
  'mao': 'manaus',
  'manaus': 'manaus',
  'sao gabriel da cachoeira': 'sao gabriel da cachoeira',
  's gabriel da cachoeira': 'sao gabriel da cachoeira',
  's. gabriel da cachoeira': 'sao gabriel da cachoeira',
  'sao paulo de olivenca': 'sao paulo de olivenca',
  's paulo de olivenca': 'sao paulo de olivenca',
  's. paulo de olivenca': 'sao paulo de olivenca',
  'sao sebastiao do uatuma': 'sao sebastiao do uatuma',
  's sebastiao do uatuma': 'sao sebastiao do uatuma',
  's. sebastiao do uatuma': 'sao sebastiao do uatuma',
  'sta isabel do rio negro': 'santa isabel do rio negro',
  's isabel do rio negro': 'santa isabel do rio negro',
  's. isabel do rio negro': 'santa isabel do rio negro',
  'santa isabel do rio negro': 'santa isabel do rio negro',
  'pres figueiredo': 'presidente figueiredo',
  'pres. figueiredo': 'presidente figueiredo',
  'presidente figueiredo': 'presidente figueiredo',
  'careiro da varzea': 'careiro da varzea',
  'careiro da várzea': 'careiro da varzea',
  'boa vista do ramos': 'boa vista do ramos',
  // Maranhão (MA) aliases
  'slz': 'sao luis',
  'sao luiz': 'sao luis',
  's. luis': 'sao luis',
  's. luiz': 'sao luis',
  'sao jose de ribamar': 'sao jose de ribamar',
  's jose de ribamar': 'sao jose de ribamar',
  's. jose de ribamar': 'sao jose de ribamar',
  'paco do lumiar': 'paco do lumiar',
  'santa ines': 'santa ines',
  'sta ines': 'santa ines',
  'sta. ines': 'santa ines',
  'santa luzia': 'santa luzia',
  'sta luzia': 'santa luzia',
  'sta. luzia': 'santa luzia',
  'barra do corda': 'barra do corda',
  'itapecuru mirim': 'itapecuru mirim',
  'itapecuru-mirim': 'itapecuru mirim',
  // Paraíba (PB) aliases
  'jampa': 'joao pessoa',
  'jpa': 'joao pessoa',
  'j. pessoa': 'joao pessoa',
  'j pessoa': 'joao pessoa',
  's bento pb': 'sao bento',
  's. bento pb': 'sao bento',
  'santa rita': 'santa rita',
  'sta rita': 'santa rita',
  'sta. rita': 'santa rita',
  'pedras de fogo': 'pedras de fogo',
  'pedras de fogos': 'pedras de fogo',
  // Rio Grande do Norte (RN) aliases
  'nat': 'natal',
  'mossoro': 'mossoro',
  'assu': 'acu',
  'sao goncalo rn': 'sao goncalo do amarante',
  's goncalo rn': 'sao goncalo do amarante',
  's. goncalo rn': 'sao goncalo do amarante',
  'ceara mirim': 'ceara-mirim',
  'ceara-mirim': 'ceara-mirim',
  'sao jose de mipibu': 'sao jose de mipibu',
  's jose de mipibu': 'sao jose de mipibu',
  's. jose de mipibu': 'sao jose de mipibu',
  'sta cruz rn': 'santa cruz',
  'sta. cruz rn': 'santa cruz',
  'nisia floresta': 'nisia floresta',
  'n. floresta': 'nisia floresta',
  'joao camara': 'joao camara',
  'j. camara': 'joao camara',
  'j camara': 'joao camara',
  // Alagoas (AL) aliases
  'mcz': 'maceio',
  'palmeira dos indios': 'palmeira dos indios',
  'p. dos indios': 'palmeira dos indios',
  'p dos indios': 'palmeira dos indios',
  'sao miguel dos campos': 'sao miguel dos campos',
  's miguel dos campos': 'sao miguel dos campos',
  's. miguel dos campos': 'sao miguel dos campos',
  'sao luis do quitunde': 'sao luis do quitunde',
  's luis do quitunde': 'sao luis do quitunde',
  's. luis do quitunde': 'sao luis do quitunde',
  'sao jose da tapera': 'sao jose da tapera',
  's jose da tapera': 'sao jose da tapera',
  's. jose da tapera': 'sao jose da tapera',
  'uniao dos palmares': 'uniao dos palmares',
  'u. dos palmares': 'uniao dos palmares',
  'u dos palmares': 'uniao dos palmares',
  'delmiro': 'delmiro gouveia',
  'marechal': 'marechal deodoro',
  'santana do ipanema': 'santana do ipanema',
  'sta ana do ipanema': 'santana do ipanema',
  'sta. ana do ipanema': 'santana do ipanema',
  'teotonio': 'teotonio vilela',
  // Sergipe (SE) aliases
  'aju': 'aracaju',
  'nossa senhora do socorro': 'nossa senhora do socorro',
  'ns do socorro': 'nossa senhora do socorro',
  'n s do socorro': 'nossa senhora do socorro',
  'n sra do socorro': 'nossa senhora do socorro',
  'socorro': 'nossa senhora do socorro',
  'nossa senhora da gloria': 'nossa senhora da gloria',
  'ns da gloria': 'nossa senhora da gloria',
  'n s da gloria': 'nossa senhora da gloria',
  'gloria se': 'nossa senhora da gloria',
  'sao cristovao': 'sao cristovao',
  's cristovao': 'sao cristovao',
  'barra dos coqueiros': 'barra dos coqueiros',
  'barra dos coqueiro': 'barra dos coqueiros',
  'tobias barreto': 'tobias barreto',
  't barreto': 'tobias barreto',
  'simao dias': 'simao dias',
  's dias': 'simao dias',
  'poco redondo': 'poco redondo',
  'p redondo': 'poco redondo',
  // Piauí (PI) aliases
  'the': 'teresina',
  'teresina': 'teresina',
  'parnaiba': 'parnaiba',
  'phb': 'parnaiba',
  'picos': 'picos',
  'piripiri': 'piripiri',
  'floriano': 'floriano',
  'campo maior': 'campo maior',
  'c maior': 'campo maior',
  'barras': 'barras',
  'uniao': 'uniao',
  'altos': 'altos',
  'esperantina': 'esperantina',
  'jose de freitas': 'jose de freitas',
  'j de freitas': 'jose de freitas',
  'pedro ii': 'pedro ii',
  'pedro 2': 'pedro ii',
  'oeiras': 'oeiras',
  'sao raimundo nonato': 'sao raimundo nonato',
  's raimundo nonato': 'sao raimundo nonato',
  'srn': 'sao raimundo nonato',
  'luis correia': 'luis correia',
  'l correia': 'luis correia',
  // Mato Grosso (MT) aliases
  'cba': 'cuiaba',
  'cuiaba': 'cuiaba',
  'varzea grande': 'varzea grande',
  'vg': 'varzea grande',
  'v. grande': 'varzea grande',
  'rondonopolis': 'rondonopolis',
  'roo': 'rondonopolis',
  'sinop': 'sinop',
  'tangara da serra': 'tangara da serra',
  't da serra': 'tangara da serra',
  't. da serra': 'tangara da serra',
  'caceres': 'caceres',
  'sorriso': 'sorriso',
  'lucas do rio verde': 'lucas do rio verde',
  'l do rio verde': 'lucas do rio verde',
  'l. do rio verde': 'lucas do rio verde',
  'primavera do leste': 'primavera do leste',
  'p do leste': 'primavera do leste',
  'p. do leste': 'primavera do leste',
  'barra do garcas': 'barra do garcas',
  'b do garcas': 'barra do garcas',
  'b. do garcas': 'barra do garcas',
  'alta floresta': 'alta floresta',
  'a floresta': 'alta floresta',
  'pontes e lacerda': 'pontes e lacerda',
  'p e lacerda': 'pontes e lacerda',
  'nova mutum': 'nova mutum',
  'n mutum': 'nova mutum',
  // Mato Grosso do Sul (MS) aliases
  'cg': 'campo grande',
  'campo grande': 'campo grande',
  'dourados': 'dourados',
  'dou': 'dourados',
  'tres lagoas': 'tres lagoas',
  't lagoas': 'tres lagoas',
  't. lagoas': 'tres lagoas',
  'corumba': 'corumba',
  'cor': 'corumba',
  'ponta pora': 'ponta pora',
  'p pora': 'ponta pora',
  'p. pora': 'ponta pora',
  'navirai': 'navirai',
  'nova andradina': 'nova andradina',
  'n andradina': 'nova andradina',
  'n. andradina': 'nova andradina',
  'sidrolandia': 'sidrolandia',
  'aquidauana': 'aquidauana',
  'maracaju': 'maracaju',
  'paranaiba': 'paranaiba',
  'amambai': 'amambai',
  'rio brilhante': 'rio brilhante',
  'r brilhante': 'rio brilhante',
  'coxim': 'coxim',
  'caarapo': 'caarapo',
  'miranda': 'miranda',
  'jardim': 'jardim',
  'sao gabriel do oeste': 'sao gabriel do oeste',
  // Rondônia (RO) aliases
  'pvh': 'porto velho',
  'porto velho': 'porto velho',
  'ji parana': 'ji parana',
  'jip': 'ji parana',
  'ariquemes': 'ariquemes',
  'arq': 'ariquemes',
  'vilhena': 'vilhena',
  'vha': 'vilhena',
  'cacoal': 'cacoal',
  'cac': 'cacoal',
  'rolim de moura': 'rolim de moura',
  'r moura': 'rolim de moura',
  'jaru': 'jaru',
  'guajara mirim': 'guajara mirim',
  'g mirim': 'guajara mirim',
  'ouro preto do oeste': 'ouro preto do oeste',
  'o p do oeste': 'ouro preto do oeste',
  'pimenta bueno': 'pimenta bueno',
  'p bueno': 'pimenta bueno',
  'buritis': 'buritis',
  'machadinho d oeste': 'machadinho d oeste',
  'machadinho do oeste': 'machadinho d oeste',
  'espigao d oeste': 'espigao d oeste',
  'espigao do oeste': 'espigao d oeste',
  'alta floresta d oeste': 'alta floresta d oeste',
  'alta floresta do oeste': 'alta floresta d oeste',
  'candeias do jamari': 'candeias do jamari',
  'sao miguel do guapore': 'sao miguel do guapore',
  'nova mamore': 'nova mamore',
  // Acre (AC) aliases
  'rb': 'rio branco',
  'rio branco': 'rio branco',
  'cruzeiro do sul': 'cruzeiro do sul',
  'czs': 'cruzeiro do sul',
  'sena madureira': 'sena madureira',
  's madureira': 'sena madureira',
  'tarauaca': 'tarauaca',
  'feijo': 'feijo',
  'brasileia': 'brasileia',
  'senador guiomard': 'senador guiomard',
  's guiomard': 'senador guiomard',
  'placido de castro': 'placido de castro',
  'p de castro': 'placido de castro',
  'xapuri': 'xapuri',
  'epitaciolandia': 'epitaciolandia',
  'mancio lima': 'mancio lima',
  'm lima': 'mancio lima',
  'porto acre': 'porto acre',
  'rodrigues alves': 'rodrigues alves',
  'r alves': 'rodrigues alves',
  'marechal thaumaturgo': 'marechal thaumaturgo',
  'm thaumaturgo': 'marechal thaumaturgo',
  'manoel urbano': 'manoel urbano',
  'm urbano': 'manoel urbano',
  'porto walter': 'porto walter',
  'p walter': 'porto walter',
  'acrelandia': 'acrelandia',
  // Amapá (AP) aliases
  'mcp': 'macapa',
  'macapa': 'macapa',
  'santana': 'santana',
  'stn': 'santana',
  'laranjal do jari': 'laranjal do jari',
  'l do jari': 'laranjal do jari',
  'oiapoque': 'oiapoque',
  'opq': 'oiapoque',
  'porto grande': 'porto grande',
  'p grande': 'porto grande',
  'mazagao': 'mazagao',
  'mzg': 'mazagao',
  'tartarugalzinho': 'tartarugalzinho',
  'pedra branca do amapari': 'pedra branca do amapari',
  'p branca do amapari': 'pedra branca do amapari',
  'vitoria do jari': 'vitoria do jari',
  'v do jari': 'vitoria do jari',
  'calcoene': 'calcoene',
  'amapa': 'amapa',
  'ferreira gomes': 'ferreira gomes',
  'f gomes': 'ferreira gomes',
  'cutias': 'cutias',
  'itaubal': 'itaubal',
  'pracuuba': 'pracuuba',
  'serra do navio': 'serra do navio',
  // Roraima (RR) aliases
  'bva': 'boa vista',
  'boa vista': 'boa vista',
  'rorainopolis': 'rorainopolis',
  'rrp': 'rorainopolis',
  'caracarai': 'caracarai',
  'pacaraima': 'pacaraima',
  'canta': 'canta',
  'mucajai': 'mucajai',
  'alto alegre': 'alto alegre',
  'bonfim': 'bonfim',
  'amajari': 'amajari',
  'iracema': 'iracema',
  'caroebe': 'caroebe',
  'normandia': 'normandia',
  'uiramuta': 'uiramuta',
  'sao joao da baliza': 'sao joao da baliza',
  // Tocantins (TO) aliases
  'pmw': 'palmas',
  'palmas': 'palmas',
  'araguaina': 'araguaina',
  'aux': 'araguaina',
  'gurupi': 'gurupi',
  'grp': 'gurupi',
  'porto nacional': 'porto nacional',
  'p nacional': 'porto nacional',
  'paraiso do tocantins': 'paraiso do tocantins',
  'p do tocantins': 'paraiso do tocantins',
  'colinas do tocantins': 'colinas do tocantins',
  'c do tocantins': 'colinas do tocantins',
  'guarai': 'guarai',
  'tocantinopolis': 'tocantinopolis',
  'dianopolis': 'dianopolis',
  'formoso do araguaia': 'formoso do araguaia',
  'miracema do tocantins': 'miracema do tocantins',
  'augustinopolis': 'augustinopolis',
  'taguatinga': 'taguatinga',
  'pedro afonso': 'pedro afonso',
  'xambioa': 'xambioa'
};

export interface CoordinateValidationResult {
  valid: boolean;
  latitude: number | null;
  longitude: number | null;
  wasInverted?: boolean;
  precision: 'exact' | 'approximate' | 'invalid' | 'none';
  reason?: string;
}

export class GeoNormalizationService {
  
  /**
   * Valida código de estado IBGE (2 dígitos numéricos de 11 a 53).
   */
  static isValidIbgeStateCode(code: string | number): boolean {
    if (!code) return false;
    const str = String(code).trim();
    if (!/^\d{2}$/.test(str)) return false;
    const validStateCodes = new Set([
      '11', '12', '13', '14', '15', '16', '17', // Norte
      '21', '22', '23', '24', '25', '26', '27', '28', '29', // Nordeste
      '31', '32', '33', '35', // Sudeste
      '41', '42', '43', // Sul
      '50', '51', '52', '53' // Centro-Oeste
    ]);
    return validStateCodes.has(str);
  }

  /**
   * Calcula o dígito verificador do código IBGE de 7 dígitos a partir dos 6 primeiros dígitos (módulo 10).
   */
  static calculateIbgeCheckDigit(first6Digits: string): number {
    const weights = [1, 2, 1, 2, 1, 2];
    let sum = 0;
    for (let i = 0; i < 6; i++) {
      let product = parseInt(first6Digits[i], 10) * weights[i];
      if (product > 9) {
        product = Math.floor(product / 10) + (product % 10);
      }
      sum += product;
    }
    const remainder = sum % 10;
    return remainder === 0 ? 0 : (10 - remainder);
  }

  /**
   * Valida código de município IBGE (6 dígitos legados ou 7 dígitos padrão com dígito verificador).
   */
  static isValidIbgeMunicipalityCode(code: string | number): boolean {
    if (!code) return false;
    const str = String(code).trim();
    if (!/^\d{6,7}$/.test(str)) return false;

    // Prefixo deve ser um código de estado válido
    const statePrefix = str.substring(0, 2);
    if (!this.isValidIbgeStateCode(statePrefix)) return false;

    if (str.length === 7) {
      const calculatedDigit = this.calculateIbgeCheckDigit(str.substring(0, 6));
      const actualDigit = parseInt(str[6], 10);
      return calculatedDigit === actualDigit;
    }

    return true; // 6 dígitos
  }

  /**
   * Valida coordenadas geográficas (bounds do Brasil, inversão lat/lon, Null Island).
   * Bounding box oficial do Brasil: Latitude [-34.0, +5.5], Longitude [-74.0, -34.0].
   */
  static validateCoordinates(lat: any, lon: any): CoordinateValidationResult {
    if (lat === null || lat === undefined || lon === null || lon === undefined || lat === '' || lon === '') {
      return { valid: false, latitude: null, longitude: null, precision: 'none', reason: 'Coordenadas ausentes' };
    }

    const nLat = typeof lat === 'number' ? lat : parseFloat(String(lat).replace(',', '.'));
    const nLon = typeof lon === 'number' ? lon : parseFloat(String(lon).replace(',', '.'));

    if (isNaN(nLat) || isNaN(nLon) || !isFinite(nLat) || !isFinite(nLon)) {
      return { valid: false, latitude: null, longitude: null, precision: 'invalid', reason: 'Coordenadas não-numéricas ou inválidas' };
    }

    // Null Island (0, 0)
    if (Math.abs(nLat) < 0.0001 && Math.abs(nLon) < 0.0001) {
      return { valid: false, latitude: null, longitude: null, precision: 'invalid', reason: 'Null Island (0,0) detectado' };
    }

    // Detecção de Inversão Latitude <-> Longitude
    // Se lat está na faixa de longitude brasileira [-74, -34] e lon está na faixa de latitude [-34, 6]
    if (nLat >= -74.5 && nLat <= -34.0 && nLon >= -34.5 && nLon <= 6.0) {
      const fixedLat = nLon;
      const fixedLon = nLat;
      return {
        valid: true,
        latitude: Number(fixedLat.toFixed(6)),
        longitude: Number(fixedLon.toFixed(6)),
        wasInverted: true,
        precision: 'approximate',
        reason: 'Coordenadas invertidas corrigidas automaticamente'
      };
    }

    // Validação nos limites geográficos do Brasil
    if (nLat < -34.0 || nLat > 5.5 || nLon < -74.5 || nLon > -34.0) {
      return { valid: false, latitude: null, longitude: null, precision: 'invalid', reason: 'Coordenadas fora do território brasileiro' };
    }

    // Precisão decimal
    const latDecimals = (String(lat).split('.')[1] || '').length;
    const lonDecimals = (String(lon).split('.')[1] || '').length;
    const precision = (latDecimals >= 4 && lonDecimals >= 4) ? 'exact' : 'approximate';

    return {
      valid: true,
      latitude: Number(nLat.toFixed(6)),
      longitude: Number(nLon.toFixed(6)),
      wasInverted: false,
      precision
    };
  }

  /**
   * Normaliza um texto removendo acentuação, caracteres especiais e convertendo para minúsculas.
   */
  static normalizeText(text: string): string {
    if (!text) return '';
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove acentos
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ") // Converte pontuação em espaço
      .replace(/\s+/g, " ") // Unifica múltiplos espaços
      .trim();
  }

  /**
   * Resolve variações históricas ou abreviadas de nomes de municípios para a forma canônica IBGE.
   */
  static canonicalizeMunicipalityName(name: string): string {
    const raw = this.normalizeText(name);
    if (!raw) return '';
    if (MUNICIPALITY_ALIASES[raw]) {
      return MUNICIPALITY_ALIASES[raw];
    }
    // Remove prefixos comuns de abreviação 's ' quando aplicável
    if (raw.startsWith('s ') && !raw.startsWith('sao ') && !raw.startsWith('santa ') && !raw.startsWith('santo ')) {
      const expanded = 'sao ' + raw.substring(2);
      if (MUNICIPALITY_ALIASES[expanded]) {
        return MUNICIPALITY_ALIASES[expanded];
      }
    }
    return raw;
  }

  /**
   * Busca registro de município oficial IBGE a partir de código IBGE (7 ou 6 dígitos).
   */
  async findMunicipalityByCode(code: string | number) {
    if (!code) return null;
    const str = String(code).trim();
    try {
      // Busca exata pelo código de 7 dígitos
      const results = await db
        .select()
        .from(geographicMunicipalities)
        .where(eq(geographicMunicipalities.code, str))
        .limit(1);

      if (results.length > 0) return results[0];

      // Se for código de 6 dígitos, tenta prefixo
      if (str.length === 6) {
        const prefixResults = await db
          .select()
          .from(geographicMunicipalities)
          .where(sql`${geographicMunicipalities.code} LIKE ${str + '%'}`)
          .limit(1);
        if (prefixResults.length > 0) return prefixResults[0];
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Busca registro de município oficial IBGE a partir de uma string potencialmente despadronizada.
   */
  async findMunicipality(dirtyName: string, stateAcronym?: string) {
    const canonical = GeoNormalizationService.canonicalizeMunicipalityName(dirtyName);
    if (!canonical) return null;

    try {
      if (stateAcronym) {
        const stateNorm = stateAcronym.trim().toUpperCase();
        const results = await db
          .select()
          .from(geographicMunicipalities)
          .where(
            and(
              eq(geographicMunicipalities.normalizedName, canonical),
              eq(geographicMunicipalities.stateAcronym, stateNorm)
            )
          )
          .limit(1);

        if (results.length > 0) return results[0];

        // Se não encontrou, tenta busca direta sem expansão de alias
        const rawNorm = GeoNormalizationService.normalizeText(dirtyName);
        if (rawNorm !== canonical) {
          const rawResults = await db
            .select()
            .from(geographicMunicipalities)
            .where(
              and(
                eq(geographicMunicipalities.normalizedName, rawNorm),
                eq(geographicMunicipalities.stateAcronym, stateNorm)
              )
            )
            .limit(1);
          if (rawResults.length > 0) return rawResults[0];
        }

        return null;
      } else {
        const results = await db
          .select()
          .from(geographicMunicipalities)
          .where(eq(geographicMunicipalities.normalizedName, canonical))
          .limit(1);
        return results[0] || null;
      }
    } catch {
      return null;
    }
  }

  /**
   * Encontra o município mais próximo com base em coordenadas lat/lon e distância euclidiana/haversine.
   */
  async findNearestMunicipality(lat: number, lon: number, maxDistanceMeters = 60000) {
    // Lista incorporada de referência para capitais e principais municípios de SP e do Brasil
    const DEFAULT_REFERENCE_MUNIS = [
      { code: '3550308', name: 'São Paulo', stateAcronym: 'SP', latitude: -23.5505, longitude: -46.6333, population: 11451245 },
      { code: '3518800', name: 'Guarulhos', stateAcronym: 'SP', latitude: -23.4542, longitude: -46.5333, population: 1291771 },
      { code: '3548708', name: 'São Bernardo do Campo', stateAcronym: 'SP', latitude: -23.6914, longitude: -46.5646, population: 810729 },
      { code: '3547809', name: 'Santo André', stateAcronym: 'SP', latitude: -23.6572, longitude: -46.5333, population: 748919 },
      { code: '3534401', name: 'Osasco', stateAcronym: 'SP', latitude: -23.5325, longitude: -46.7917, population: 728615 },
      { code: '3509502', name: 'Campinas', stateAcronym: 'SP', latitude: -22.9056, longitude: -47.0608, population: 1139047 },
      { code: '3549904', name: 'São José dos Campos', stateAcronym: 'SP', latitude: -23.1794, longitude: -45.8869, population: 697054 },
      { code: '3543402', name: 'Ribeirão Preto', stateAcronym: 'SP', latitude: -21.1767, longitude: -47.8108, population: 698642 },
      { code: '3552205', name: 'Sorocaba', stateAcronym: 'SP', latitude: -23.5017, longitude: -47.4581, population: 723682 },
      { code: '3548500', name: 'Santos', stateAcronym: 'SP', latitude: -23.9608, longitude: -46.3336, population: 418608 },
      { code: '3304557', name: 'Rio de Janeiro', stateAcronym: 'RJ', latitude: -22.9068, longitude: -43.1729, population: 6211423 },
      { code: '3106200', name: 'Belo Horizonte', stateAcronym: 'MG', latitude: -19.9208, longitude: -43.9378, population: 2315560 },
      { code: '4106902', name: 'Curitiba', stateAcronym: 'PR', latitude: -25.4290, longitude: -49.2671, population: 1773733 },
      { code: '4314902', name: 'Porto Alegre', stateAcronym: 'RS', latitude: -30.0346, longitude: -51.2177, population: 1332570 },
      { code: '2927408', name: 'Salvador', stateAcronym: 'BA', latitude: -12.9777, longitude: -38.5016, population: 2418005 },
      { code: '2304400', name: 'Fortaleza', stateAcronym: 'CE', latitude: -3.7319, longitude: -38.5267, population: 2428678 },
      { code: '2611606', name: 'Recife', stateAcronym: 'PE', latitude: -8.0476, longitude: -34.8770, population: 1488920 },
      { code: '5300108', name: 'Brasília', stateAcronym: 'DF', latitude: -15.7942, longitude: -47.8822, population: 2817068 }
    ];

    let munis: any[] = [];
    try {
      munis = await db
        .select({
          code: geographicMunicipalities.code,
          name: geographicMunicipalities.name,
          stateAcronym: geographicMunicipalities.stateAcronym,
          latitude: geographicMunicipalities.latitude,
          longitude: geographicMunicipalities.longitude,
          population: geographicMunicipalities.population
        })
        .from(geographicMunicipalities);
    } catch {
      munis = [];
    }

    const candidateList = (munis && munis.length > 0) ? munis : DEFAULT_REFERENCE_MUNIS;

    let nearest: any = null;
    let minDistance = Infinity;

    for (const m of candidateList) {
      if (m.latitude !== null && m.longitude !== null) {
        const dist = haversineDistance(lat, lon, Number(m.latitude), Number(m.longitude));
        if (dist < minDistance && dist <= maxDistanceMeters) {
          minDistance = dist;
          nearest = { ...m, distanceMeters: dist };
        }
      }
    }

    // Se nenhuma distância menor que maxDistanceMeters foi encontrada, mas está dentro dos limites de SP
    if (!nearest && lat >= -25.5 && lat <= -19.5 && lon >= -53.5 && lon <= -44.0) {
      return {
        code: '3550308',
        name: 'São Paulo',
        stateAcronym: 'SP',
        latitude: -23.5505,
        longitude: -46.6333,
        population: 11451245,
        distanceMeters: haversineDistance(lat, lon, -23.5505, -46.6333)
      };
    }

    return nearest;
  }

  async findStateByAcronym(acronym: string) {
    const stateNorm = acronym.trim().toUpperCase();
    try {
      const results = await db
        .select()
        .from(geographicStates)
        .where(eq(geographicStates.acronym, stateNorm))
        .limit(1);
      return results[0] || null;
    } catch {
      return null;
    }
  }
}
