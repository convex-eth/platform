const fs = require('fs');
const { ethers } = require("ethers");
const jsonfile = require('jsonfile');
const { ARAGON_VOTING, ARGAON_AGENT, GAUGE_CONTROLLER, SIDE_GAUGE_FACTORY, OWNER_PROXY, WHITELIST_CHECKER, CURVE_GUAGE, POOL_FACTORY } = require('./abi');
var BN = require('big-number');

const config = jsonfile.readFileSync('./config.json');

/*
Decode proposal data and check for valid gauges

To use: 
npm i
Create a config.json with necessary keys: USE_PROVIDER, NETWORK, XXX_KEY
node proposalDecode proposalID
*/


//Setup ethers providers
var provider;
if (config.USE_PROVIDER == "infura") {
  provider = new ethers.providers.InfuraProvider(config.NETWORK, config.INFURA_KEY);
} else if (config.USE_PROVIDER == "alchemy") {
  provider = new ethers.providers.AlchemyProvider(config.NETWORK, config.ALCHEMY_KEY);
} else {
  provider = new ethers.providers.JsonRpcProvider(config.GETH_NODE, config.NETWORK);
}

const proposalAddress = "0xe478de485ad2fe566d49342cbd03e49ed7db3356";
const proposalContract = new ethers.Contract(proposalAddress, ARAGON_VOTING, provider);
const proposalInstance = proposalContract.connect(provider);

const proposalParameterAddress = "0xBCfF8B0b9419b9A88c44546519b1e909cF330399";
const proposalParameterContract = new ethers.Contract(proposalParameterAddress, ARAGON_VOTING, provider);
const proposalParameterInstance = proposalParameterContract.connect(provider);

const sideGaugeFactoryContract = new ethers.Contract("0xabC000d88f23Bb45525E447528DBF656A9D55bf5", SIDE_GAUGE_FACTORY, provider);
const sideGaugeFactoryInstance = sideGaugeFactoryContract.connect(provider);


function byteToHexString(uint8arr) {
  if (!uint8arr) {
    return '';
  }
  
  var hexStr = '';
  for (var i = 0; i < uint8arr.length; i++) {
    var hex = (uint8arr[i] & 0xff).toString(16);
    hex = (hex.length === 1) ? '0' + hex : hex;
    hexStr += hex;
  }
  
  return hexStr.toLowerCase();
}

function hexStringToByte(str) {
  if (!str) {
    return new Uint8Array();
  }
  
  var a = [];
  for (var i = 0, len = str.length; i < len; i+=2) {
    a.push(parseInt(str.substr(i,2),16));
  }
  
  return new Uint8Array(a);
}


function intFromByteArray(array) {
    var value = 0;
    for (var i = 0; i < array.length; i++) {
        value = (value * 256) + array[i];
    }
    return value;
}

function etherscan(address){
    return "(https://etherscan.io/address/"+address+")";
}

function gaugeType(type){
    if(type == "0"){
        return "Ethereum Chain";
    }
    if(type == "1"){
        return "Fantom Chain";
    }
    if(type == "2"){
        return "Polygon/Matic Chain";
    }
    if(type == "4"){
        return "xDai Chain";
    }
    if(type == "5"){
        return "Ethereum Chain (Crypto Pools)";
    }
    if(type == "7"){
        return "Arbitrum Chain";
    }
    if(type == "8"){
        return "Avalanche Chain";
    }
    if(type == "9"){
        return "Harmony Chain";
    }
    return "Unknown Type " +type;
}

function addressName(address){
    if(address.toLowerCase() == "0x2F50D538606Fa9EDD2B11E2446BEb18C9D5846bB".toLowerCase() ){
        return "Curve Gauge Controller"
    }
    if(address.toLowerCase() == "0x2EF1Bc1961d3209E5743C91cd3fBfa0d08656bC3".toLowerCase() ){
        return "Curve Owner Proxy"
    }
    if(address.toLowerCase() == "0x5a8fdC979ba9b6179916404414F7BA4D8B77C8A1".toLowerCase() ){
        return "Curve Crypto Owner Proxy"
    }
    if(address.toLowerCase() == "0x742C3cF9Af45f91B109a81EfEaf11535ECDe9571".toLowerCase() ){
        return "Curve StableSwap Owner Proxy"
    }
    if(address.toLowerCase() == "0x017dB2B92233018973902858B31269Ed071E1D39".toLowerCase() ){
        return "Curve Root Gauge Owner Proxy"
    }
    if(address.toLowerCase() == "0xca719728Ef172d0961768581fdF35CB116e0B7a4".toLowerCase() ){
        return "Curve Whitelist Checker"
    }
    return "Unknown " +address
}

const isValidGauge = async(address) => {
    const VALID_BYTECODE = [
        '0x363d3d373d3d3d363d73dc892358d55d5ae1ec47a531130d62151eba36e55af43d82803e903d91602b57fd5bf3',
        '0x363d3d373d3d3d363d735ae854b098727a9f1603a1e21c50d52dc834d8465af43d82803e903d91602b57fd5bf3'
    ]

    const v6_bytecode = "0x6003361161000c57611937565b5f3560e01c3461260a5763bfa0b133811861003357602061265b5f395f5160405260206040f35b6370a08231811861006c576024361061260a576004358060a01c61260a5760405260016040516020525f5260405f205460605260206060f35b6318160ddd81186100835760025460405260206040f35b63dd62ed3e81186100d9576044361061260a576004358060a01c61260a576040526024358060a01c61260a5760605260036040516020525f5260405f20806060516020525f5260405f2090505460805260206080f35b6306fdde0381186101545760208060405280604001600454602082015f82601f0160051c6002811161260a57801561012457905b80600501548160051b84015260010181811861010d575b505050808252508051806020830101601f825f03163682375050601f19601f825160200101169050810190506040f35b6395d89b4181186101cf5760208060405280604001600754602082015f82601f0160051c6002811161260a57801561019f57905b80600801548160051b840152600101818118610188575b505050808252508051806020830101601f825f03163682375050601f19601f825160200101169050810190506040f35b637ecebe008118610208576024361061260a576004358060a01c61260a57604052600a6040516020525f5260405f205460605260206060f35b63c45a0155811861021f57600b5460405260206040f35b6382c63066811861023657600c5460405260206040f35b639c868ac0811861024d57600d5460405260206040f35b63963c94b9811861026457600f5460405260206040f35b6348e9c65e81186102c8576024361061260a576004358060a01c61260a5760405260106040516020525f5260405f2080546060526001810154608052600281015460a052600381015460c052600481015460e0526005810154610100525060c06060f35b6301ddabf18118610301576024361061260a576004358060a01c61260a5760405260116040516020525f5260405f205460605260206060f35b63f05cc0588118610357576044361061260a576004358060a01c61260a576040526024358060a01c61260a5760605260126040516020525f5260405f20806060516020525f5260405f2090505460805260206080f35b6313ecb1ca8118610390576024361061260a576004358060a01c61260a5760405260146040516020525f5260405f205460605260206060f35b6317e2808981186103a75760155460405260206040f35b63de263bfa81186103e0576024361061260a576004358060a01c61260a5760405260166040516020525f5260405f205460605260206060f35b639bd324f28118610419576024361061260a576004358060a01c61260a5760405260176040516020525f5260405f205460605260206060f35b63094007078118610452576024361061260a576004358060a01c61260a5760405260186040516020525f5260405f205460605260206060f35b63ef78d4fd81186104695760195460405260206040f35b6354c49fe98118610494576024361061260a576004356007811161260a57601a015460405260206040f35b637598108c81186104cb576024361061260a576004356c01431e0fae6d7217ca9fffffff811161260a576022015460405260206040f35b63fec8ee0c811861050e576024361061260a576004356c01431e0fae6d7217ca9fffffff811161260a576c01431e0fae6d7217caa0000022015460405260206040f35b63b6b55f258118610530576024361061260a5733610360525f6103805261058e565b636e553f65811861055c576044361061260a576024358060a01c61260a57610360525f6103805261058e565b6383df67478118610722576064361061260a576024358060a01c61260a57610360526044358060011c61260a57610380525b5f5460021461260a5760025f55610360516040526105aa6119da565b600435156106b757600f5415156103a0526002546103c0526103a051156105ec57610360516040526103c051606052610380516080525f60a0526105ec611f14565b6103c05160043580820182811061260a57905090506103c0526001610360516020525f5260405f205460043580820182811061260a57905090506103e0526103e0516001610360516020525f5260405f20556103c051600255610360516040526103e0516060526103c0516080526106626122ec565b600c546323b872dd6104005233610420523061044052600435610460526020610400606461041c5f855af1610699573d5f5f3e3d5ffd5b60203d1061260a57610400518060011c61260a576104805261048050505b610360517fe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c6004356103a05260206103a0a2610360515f7fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef6004356103a05260206103a0a360035f55005b632e1a7d4d811861073f576024361061260a575f61036052610762565b6338d0743681186108dc576044361061260a576024358060011c61260a57610360525b5f5460021461260a5760025f553360405261077b6119da565b6004351561087757600f541515610380526002546103a05261038051156107ba57336040526103a051606052610360516080525f60a0526107ba611f14565b6103a05160043580820382811161260a57905090506103a0526001336020525f5260405f205460043580820382811161260a57905090506103c0526103c0516001336020525f5260405f20556103a051600255336040526103c0516060526103a0516080526108276122ec565b600c5463a9059cbb6103e05233610400526004356104205260206103e060446103fc5f855af1610859573d5f5f3e3d5ffd5b60203d1061260a576103e0518060011c61260a576104405261044050505b337f884edad9ce6fa2440d8a54cc123490eb96d2768479d49ff9c7366125a9424364600435610380526020610380a25f337fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef600435610380526020610380a360035f55005b63e6f1daf281186108f65733610360525f61038052610954565b6384e9bd7e8118610922576024361061260a576004358060a01c61260a57610360525f61038052610954565b639faceb1b811861099c576044361061260a576004358060a01c61260a57610360526024358060a01c61260a57610380525b5f5460021461260a5760025f5561038051156109755733610360511861260a575b6103605160405260025460605260016080526103805160a052610996611f14565b60035f55005b6323b872dd8118610a88576064361061260a576004358060a01c61260a57610420526024358060a01c61260a57610440525f5460021461260a5760025f556003610420516020525f5260405f2080336020525f5260405f20905054610460527fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff6104605114610a58576104605160443580820382811161260a57905090506003610420516020525f5260405f2080336020525f5260405f209050555b610420516103605261044051610380526044356103a052610a776124a2565b600161048052602061048060035f55f35b63a9059cbb8118610ae4576044361061260a576004358060a01c61260a57610420525f5460021461260a5760025f55336103605261042051610380526024356103a052610ad36124a2565b600161044052602061044060035f55f35b63095ea7b38118610b5f576044361061260a576004358060a01c61260a576040526024356003336020525f5260405f20806040516020525f5260405f20905055604051337f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92560243560605260206060a3600160605260206060f35b63d505accf8118610d5e5760e4361061260a576004358060a01c61260a57610120526024358060a01c61260a57610140526084358060081c61260a5761016052610120511561260a57606435421161260a57600a610120516020525f5260405f2054610180525f60026101c0527f19010000000000000000000000000000000000000000000000000000000000006101e0526101c0805160208201836103200181518152505080830192505050610c1761020061193b565b610200518161032001526020810190507f6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c961024052610120516102605261014051610280526044356102a052610180516102c0526064356102e05260c061022052610220805160208201209050816103200152602081019050806103005261030090508051602082012090506101a052610120516101a0516101c052610160516101e052604060a46102003760205f60806101c060015afa505f511861260a576044356003610120516020525f5260405f2080610140516020525f5260405f20905055610180516001810181811061260a579050600a610120516020525f5260405f205561014051610120517f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b9256044356101c05260206101c0a360016101c05260206101c0f35b63395093518118610e09576044361061260a576004358060a01c61260a576040526003336020525f5260405f20806040516020525f5260405f2090505460243580820182811061260a57905090506060526060516003336020525f5260405f20806040516020525f5260405f20905055604051337f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92560605160805260206080a3600160805260206080f35b63a457c2d78118610eb4576044361061260a576004358060a01c61260a576040526003336020525f5260405f20806040516020525f5260405f2090505460243580820382811161260a57905090506060526060516003336020525f5260405f20806040516020525f5260405f20905055604051337f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92560605160805260206080a3600160805260206080f35b634b8200938118610f4c576024361061260a576004358060a01c61260a576102605233610260518118610ee8576001610f01565b73d061d61a4d941c39e5453435b6345dc261c2fce08118155b90501561260a5761026051604052610f176119da565b610260516040526001610260516020525f5260405f2054606052600254608052610f3f6122ec565b6001610280526020610280f35b63bdf981168118610f7f576024361061260a576004358060a01c61260a576040526040516011336020525f5260405f2055005b6396c551758118611132576024361061260a576004358060a01c61260a57610260526017610260516020525f5260405f20546102805263da020a1861030052610260516103205263010ae7576102c052610260516102e05260206102c060246102dc735f3b5dfeb7b28cdbd7faba78963ee202a494e2a25afa611004573d5f5f3e3d5ffd5b60203d1061260a576102c051610340526020610300604461031c735f3b5dfeb7b28cdbd7faba78963ee202a494e2a25afa611041573d5f5f3e3d5ffd5b60203d1061260a57610300516102a0526001610260516020525f5260405f20546102c0526370a082316102e052610260516103005260206102e060246102fc735f3b5dfeb7b28cdbd7faba78963ee202a494e2a25afa6110a3573d5f5f3e3d5ffd5b60203d1061260a576102e0516110ba5760016110c4565b610280516102a051115b1561260a576102c0516028810281602882041861260a5790506064810490506014610260516020525f5260405f2054111561260a57610260516040526111086119da565b610260516040526001610260516020525f5260405f20546060526002546080526111306122ec565b005b6393f7aa67811861132a576044361061260a576004358060a01c61260a57610360525f5460021461260a5760025f556010610360516020525f5260405f2060018101905054331861260a575f604052600254606052604036608037611195611f14565b6323b872dd6103c4526004336103e4523061040452602435610424526060016103c0526103c05060206104806103c0516103e05f610360515af16111db573d5f5f3e3d5ffd5b3d602081183d60201002186104605261046080516020820180516103a0525080610380525050610380511561121f576103a0516103805160200360031b1c1561260a575b6010610360516020525f5260405f20600281019050546103c0526103c0514210156112c5576103c0514280820382811161260a57905090506103e0526103e0516010610360516020525f5260405f206003810190505480820281158383830414171561260a5790509050610400526024356104005180820182811061260a579050905062093a80810490506010610360516020525f5260405f20600381019050556112e7565b60243562093a80810490506010610360516020525f5260405f20600381019050555b426010610360516020525f5260405f20600481019050554262093a80810181811061260a5790506010610360516020525f5260405f206002810190505560035f55005b63e8de0d4d8118611404576044361061260a576004358060a01c61260a576040526024358060a01c61260a57606052600b5463f851a440608052602060806004609c845afa61137b573d5f5f3e3d5ffd5b60203d1061260a576080518060a01c61260a5760c05260c0905051331861260a57600f5460805260076080511161260a5760106040516020525f5260405f206001810190505461260a5760605160106040516020525f5260405f20600181019050556040516080516007811161260a57601a01556080516001810181811061260a579050600f55005b63058a3a2481186114cb576044361061260a576004358060a01c61260a576040526024358060a01c61260a5760605260106040516020525f5260405f2060018101905054608052608051331861145b57600161149c565b600b5463f851a44060a052602060a0600460bc845afa61147d573d5f5f3e3d5ffd5b60203d1061260a5760a0518060a01c61260a5760e05260e09050513318155b1561260a576080511561260a576060511561260a5760605160106040516020525f5260405f2060018101905055005b6390b229978118611537576024361061260a576004358060011c61260a57604052600b5463f851a440606052602060606004607c845afa61150e573d5f5f3e3d5ffd5b60203d1061260a576060518060a01c61260a5760a05260a0905051331861260a57604051600d55005b63e77e743781186115a2576044361061260a576004358060a01c61260a576040526024358060a01c61260a5760605260136040516020525f5260405f20806060516020525f5260405f209050546fffffffffffffffffffffffffffffffff8116905060805260206080f35b6333fd6f74811861175a576044361061260a576004358060a01c61260a576040526024358060a01c61260a5760605260106060516020525f5260405f206005810190505460805260025460a05260a051156116b5574260106060516020525f5260405f20600281019050548082811882841002189050905060c05260c05160106060516020525f5260405f206004810190505480820382811161260a579050905060e05260805160e05160106060516020525f5260405f206003810190505480820281158383830414171561260a5790509050670de0b6b3a7640000810281670de0b6b3a764000082041861260a57905060a051801561260a578082049050905080820182811061260a57905090506080525b60126060516020525f5260405f20806040516020525f5260405f2090505460c05260016040516020525f5260405f205460805160c05180820382811161260a579050905080820281158383830414171561260a5790509050670de0b6b3a76400008104905060e05260136040516020525f5260405f20806060516020525f5260405f2090505460801c60e05180820182811061260a5790509050610100526020610100f35b63331345838118611803576024361061260a576004358060a01c61260a57610260526102605160405261178b6119da565b6018610260516020525f5260405f2054638b752bb061028052610260516102a052306102c0526020610280604461029c73d061d61a4d941c39e5453435b6345dc261c2fce05afa6117de573d5f5f3e3d5ffd5b60203d1061260a576102805180820382811161260a57905090506102e05260206102e0f35b63d31f3f6d8118611832576019546c01431e0fae6d7217ca9fffffff811161260a576022015460405260206040f35b63be5d1be9811861184c57600e5460d81c60405260206040f35b63180692d0811861188357600e547affffffffffffffffffffffffffffffffffffffffffffffffffffff8116905060405260206040f35b63313ce567811861189957601260405260206040f35b6354fd4d5081186119185760208060805260066040527f76362e302e30000000000000000000000000000000000000000000000000000060605260408160800181516020830160208301815181525050808252508051806020830101601f825f03163682375050601f19601f8251602001011690509050810190506080f35b633644e515811861193557602061193061012061193b565b610120f35b505b5f5ffd5b602061263b5f395f5146146119cb577f8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f606052602061261b5f395f516080527ffff8816755fb13c9804fb44b52dbb9380dd81eba3e16258e5bd3c7595226aa1d60a0524660c0523060e052602061265b5f395f516101005260c060405260408051602082012090508152506119d8565b602061267b5f395f518152505b565b6019546060526060516c01431e0fae6d7217ca9fffffff811161260a57602201546080526060516c01431e0fae6d7217ca9fffffff811161260a576c01431e0fae6d7217caa0000022015460a052600e5460c05260c0517affffffffffffffffffffffffffffffffffffffffffffffffffffff8116905060e05260c05160d81c6101005260e051610120526080516101005110611b1357632c4e722e610140526020610140600461015c73d533a949740bb3306d119cc777fa900ba034cd525afa611aa7573d5f5f3e3d5ffd5b60203d1061260a57610140516101205263b26b238e610140526020610140600461015c5f73d533a949740bb3306d119cc777fa900ba034cd525af1611aee573d5f5f3e3d5ffd5b60203d1061260a576101405160d81b6101205180820182811061260a5790509050600e555b600d5415611b25575f60e0525f610120525b608051421115611e15576015546101405263615e5237610160523061018052732f50d538606fa9edd2b11e2446beb18c9d5846bb3b1561260a575f610160602461017c5f732f50d538606fa9edd2b11e2446beb18c9d5846bb5af1611b8c573d5f5f3e3d5ffd5b6080516101605260805162093a80810181811061260a57905062093a808104905062093a8081028162093a8082041861260a5790504280828118828410021890509050610180525f6101f4905b806101a052610180516101605180820382811161260a57905090506101c05263d3078c946102005230610220526101605162093a808104905062093a8081028162093a8082041861260a579050610240526020610200604461021c732f50d538606fa9edd2b11e2446beb18c9d5846bb5afa611c57573d5f5f3e3d5ffd5b60203d1061260a57610200516101e0526101405115611dcb5761016051610100511015611c84575f611c8e565b6101805161010051105b611cef5760a05160e0516101e05180820281158383830414171561260a57905090506101c05180820281158383830414171561260a579050905061014051801561260a578082049050905080820182811061260a579050905060a052611dcb565b60a05160e0516101e05180820281158383830414171561260a5790509050610100516101605180820382811161260a579050905080820281158383830414171561260a579050905061014051801561260a578082049050905080820182811061260a579050905060a0526101205160e05260a05160e0516101e05180820281158383830414171561260a5790509050610180516101005180820382811161260a579050905080820281158383830414171561260a579050905061014051801561260a578082049050905080820182811061260a579050905060a0525b426101805118611dda57611e12565b61018051610160526101805162093a80810181811061260a579050428082811882841002189050905061018052600101818118611bd9575b50505b6060516001810180600f0b811861260a579050606052606051601955426060516c01431e0fae6d7217ca9fffffff811161260a576022015560a0516060516c01431e0fae6d7217ca9fffffff811161260a576c01431e0fae6d7217caa0000022015560146040516020525f5260405f20546101405260186040516020525f5260405f2080546101405160a05160166040516020525f5260405f205480820382811161260a579050905080820281158383830414171561260a5790509050670de0b6b3a76400008104905080820182811061260a579050905081555060a05160166040516020525f5260405f20554260176040516020525f5260405f2055565b5f60c05260a05160e05260405115611f6f5760016040516020525f5260405f205460c052608051611f45575f611f4a565b60a051155b15611f6f5760116040516020525f5260405f205460e05260e051611f6f5760405160e0525b600f54610100525f6008905b8061012052610100516101205118611f92576122e8565b610120516007811161260a57601a0154610140526010610140516020525f5260405f206005810190505461016052426010610140516020525f5260405f20600281019050548082811882841002189050905061018052610180516010610140516020525f5260405f206004810190505480820382811161260a57905090506101a0526101a051156120cc57610180516010610140516020525f5260405f2060048101905055606051156120cc57610160516101a0516010610140516020525f5260405f206003810190505480820281158383830414171561260a5790509050670de0b6b3a7640000810281670de0b6b3a764000082041861260a579050606051801561260a578082049050905080820182811061260a579050905061016052610160516010610140516020525f5260405f20600581019050555b604051156122dd576012610140516020525f5260405f20806040516020525f5260405f209050546101c0525f6101e052610160516101c051101561216c57610160516012610140516020525f5260405f20806040516020525f5260405f2090505560c051610160516101c05180820382811161260a579050905080820281158383830414171561260a5790509050670de0b6b3a7640000810490506101e0525b60136040516020525f5260405f2080610140516020525f5260405f20905054610200526102005160801c6101e05180820182811061260a57905090506102205261022051156122dd57610200516fffffffffffffffffffffffffffffffff811690506102405260805161221f576101e051156122dd57610240516102205160801b80820182811061260a579050905060136040516020525f5260405f2080610140516020525f5260405f209050556122dd565b63a9059cbb6102a452600460e0516102c452610220516102e4526040016102a0526102a05060206103406102a0516102c05f610140515af1612263573d5f5f3e3d5ffd5b3d602081183d602010021861032052610320805160208201805161028052508061026052505061026051156122a757610280516102605160200360031b1c1561260a575b610240516102205180820182811061260a579050905060136040516020525f5260405f2080610140516020525f5260405f209050555b600101818118611f7b575b5050565b63bbf7408a60c05260405160e052602060c0602460dc738e0c00ed546602fd9927df742bbabf726d5b0d165afa612325573d5f5f3e3d5ffd5b60203d1061260a5760c05160a0526318160ddd60e052602060e0600460fc735f3b5dfeb7b28cdbd7faba78963ee202a494e2a25afa612366573d5f5f3e3d5ffd5b60203d1061260a5760e05160c0526060516028810281602882041861260a57905060648104905060e05260c051156123ed5760e05160805160a05180820281158383830414171561260a579050905060c051801561260a5780820490509050603c810281603c82041861260a57905060648104905080820182811061260a579050905060e0525b60605160e0518082811882841002189050905060e05260146040516020525f5260405f20546101005260e05160146040516020525f5260405f205560155460e05180820182811061260a57905090506101005180820382811161260a579050905061012052610120516015556040517f7ecd84343f76a23d2227290e0288da3251b045541698e575a5515af4f04197a3606051610140526080516101605260e05161018052610120516101a0526080610140a2565b610360516040526124b16119da565b610380516040526124c06119da565b6103a051156125d1576002546103c052600f5415156103e0526103e051156124fe57610360516040526103c0516060526040366080376124fe611f14565b6001610360516020525f5260405f20546103a05180820382811161260a579050905061040052610400516001610360516020525f5260405f205561036051604052610400516060526103c0516080526125556122ec565b6103e0511561257a57610380516040526103c05160605260403660803761257a611f14565b6001610380516020525f5260405f20546103a05180820182811061260a579050905061040052610400516001610380516020525f5260405f205561038051604052610400516060526103c0516080526125d16122ec565b61038051610360517fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef6103a0516103c05260206103c0a3565b5f80fda165767970657283000309000";

    let address_bytecode = await provider.getCode(address);
    var result = ethers.utils.isAddress(address) && (VALID_BYTECODE.includes(address_bytecode.toLowerCase()) || address_bytecode.includes(v6_bytecode));

    if(!result){
        try{
        //check if valid gauge from ng factory
        const gaugeContract = new ethers.Contract(address, CURVE_GUAGE, provider);
        var pool = await gaugeContract.lp_token();
        //is gauge if factory returns same gauge address for the pool
        const ngfactory = new ethers.Contract("0x6A8cbed756804B16E05E741eDaBd5cB544AE21bf", POOL_FACTORY, provider);
        result = address.toLowerCase() == (await ngfactory.get_gauge(pool)).toLowerCase();
        console.log("is a ng gauge? " +result)
        }catch{
            //side chain gauge will error
        }
    }

    if(!result){
        //need to check if its a sidechain gauge
        result = await sideGaugeFactoryInstance.is_valid_gauge(address);
    }

    return result;
}

const decodeGaugeControllerData = async (calldata) => {
    // console.log("gauge calldata: " +calldata)
    var scriptbytes = hexStringToByte(calldata);
    var calldataFunction = scriptbytes.slice(1,5);
    // console.log("function: " +byteToHexString(calldataFunction))
    var report = "";
    if(byteToHexString(calldataFunction) == "18dfe921"){
        let iface = new ethers.utils.Interface(GAUGE_CONTROLLER)
        report += "Function: AddGauge\n";
        var dec = iface.decodeFunctionData("add_gauge(address,int128,uint256)",calldata);
        report += "Gauge: " +dec.addr +" " +etherscan(dec.addr) +"\n";
        report += "Type: " +gaugeType(dec.gauge_type.toString()) +"\n";
        report += "Weight: "+dec.weight.toString() +"\n";

        var isvalid = await isValidGauge(dec.addr) +"\n";
        report += "Is official gauge? " +isvalid;
    }else{
        report += "Function Unknown: " +byteToHexString(calldataFunction) +"\n";
        report += "Calldata: " +calldata +"\n";
    }
    return report;
}

const decodeOwnerProxyData = async (calldata) => {
    // console.log("calldata: " +calldata)
    var scriptbytes = hexStringToByte(calldata);
    var calldataFunction = scriptbytes.slice(1,5);
    // console.log("function: " +byteToHexString(calldataFunction))
    var report = "";
    let iface = new ethers.utils.Interface(OWNER_PROXY)

    if(byteToHexString(calldataFunction) == "4344ce71"){    
        report += "Function: set_killed\n";
        var dec = iface.decodeFunctionData("set_killed(address,bool)",calldata);
        report += "Gauge: " +dec[0] +" " +etherscan(dec[0]) +"\n";
        report += "Is Killed? " +dec[1] +"\n";
    }else if(byteToHexString(calldataFunction) == "9d4a4380"){    
        report += "Function: ramp_A\n";
        var dec = iface.decodeFunctionData("ramp_A(address,uint256,uint256)",calldata);
        report += "Gauge: " +dec[0] +" " +etherscan(dec[0]) +"\n";
        report += "Future A: " +dec[1] +"\n";
        report += "Future Time: " +dec[2] +"\n";
    }else{
        report += "Function Unknown: " +byteToHexString(calldataFunction) +"\n";
        report += "Calldata: " +calldata +"\n";
    }
    return report;
}

const decodeWhitelist = async (calldata) => {
    // console.log("gauge calldata: " +calldata)
    var scriptbytes = hexStringToByte(calldata);
    var calldataFunction = scriptbytes.slice(1,5);
    // console.log("function: " +byteToHexString(calldataFunction))
    var report = "";
    if(byteToHexString(calldataFunction) == "0fcb0ae5"){
        let iface = new ethers.utils.Interface(WHITELIST_CHECKER)
        report += "Function: approveWallet\n";
        var dec = iface.decodeFunctionData("approveWallet(address)",calldata);
        report += "Address: " +dec +" " +etherscan(dec) +"\n";
    }else if(byteToHexString(calldataFunction) == "808a9d40"){
        let iface = new ethers.utils.Interface(WHITELIST_CHECKER)
        report += "Function: revokeWallet\n";
        var dec = iface.decodeFunctionData("revokeWallet(address)",calldata);
        report += "Address: " +dec +" " +etherscan(dec) +"\n";
    }else{
        report += "Function Unknown: " +byteToHexString(calldataFunction) +"\n";
        report += "Calldata: " +calldata +"\n";
    }
    return report;
}

const decodeProposal = async (vote_id, isOwnership) => {
    var votedata;
    if(isOwnership){
        votedata = await proposalInstance.getVote(vote_id);
    }else{
        votedata = await proposalParameterInstance.getVote(vote_id);
    }
    var script = votedata.script;

    // console.log(script);
    var scriptbytes = hexStringToByte(script);
    var idx = 5;
    var report = "";
    var actions = 1;
    while (idx < scriptbytes.length){
        console.log("decoding action " +actions +"...");
        report += "\n\nAction " +actions +"\n----------\n";
        var targetContract = scriptbytes.slice(idx, idx + 20);
        // console.log("targetContract: 0x" +byteToHexString(targetContract));
        idx += 20;
        var cdataLength = scriptbytes.slice(idx,idx+4);
        var cdataLength = intFromByteArray(scriptbytes.slice(idx,idx+4));
        idx += 4;
        var calldata = scriptbytes.slice(idx, idx + cdataLength);
        var cdstring = "0x"+byteToHexString(calldata);

        let iface = new ethers.utils.Interface(ARGAON_AGENT)
        var dec = iface.decodeFunctionData("execute(address,uint256,bytes)",cdstring);
        // console.log("decoded calldata: " +dec);

        if(dec[0] == "0x2F50D538606Fa9EDD2B11E2446BEb18C9D5846bB"){ //gauge controller
            report += "To: "+addressName(dec[0]) +"\n";
            report += await decodeGaugeControllerData(dec[2]);
        }else if(dec[0] == "0x2EF1Bc1961d3209E5743C91cd3fBfa0d08656bC3"){ //factory owner proxy
            report += "To: "+addressName(dec[0]) +"\n";
            report += await decodeOwnerProxyData(dec[2]);
        }else if(dec[0] == "0x5a8fdC979ba9b6179916404414F7BA4D8B77C8A1"){ //crypto factory owner proxy
            report += "To: "+addressName(dec[0]) +"\n";
            report += await decodeOwnerProxyData(dec[2]);
        }else if(dec[0] == "0x742C3cF9Af45f91B109a81EfEaf11535ECDe9571"){ //stableswap factory owner proxy
            report += "To: "+addressName(dec[0]) +"\n";
            report += await decodeOwnerProxyData(dec[2]);
        }else if(dec[0] == "0x017dB2B92233018973902858B31269Ed071E1D39"){ //root gauge factory owner proxy
            report += "To: "+addressName(dec[0]) +"\n";
            report += await decodeOwnerProxyData(dec[2]);
        }else if(dec[0] == "0xca719728Ef172d0961768581fdF35CB116e0B7a4"){ //whitelist checker
            report += "To: "+addressName(dec[0]) +"\n";
            report += await decodeWhitelist(dec[2]);
        }else{
            report += "To: " +addressName(dec[0]) +" " +etherscan(dec[0]) +"\n";
            report += "Calldata: " +dec[2] + "\n";
        }

        idx += cdataLength;

        actions++;
    }
    return report;
}


const main = async () => {

    const cmdArgs = process.argv.slice(2);
    var proposal = cmdArgs[0];
    var isOwnership = cmdArgs[1] != "false";
    console.log("decoding proposal " +proposal +", isOwnership? " +isOwnership)
    var report = await decodeProposal(proposal,isOwnership);
    console.log(report);
}

main();