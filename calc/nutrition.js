const STORAGE_KEY = "klubnikaproject.calc.nutrition.v3";
const CABINET_PROFILE_KEY = "klubnikaproject.cabinet.nutritionProfiles.v1";

const MACRO_ELEMENTS = ["N", "P", "K", "Ca", "Mg", "S"];
const MICRO_ELEMENTS = ["Fe", "B", "Zn", "Cu", "Mn", "Mo"];
const ALL_ELEMENTS = [...MACRO_ELEMENTS, ...MICRO_ELEMENTS];
const ELEMENT_LABELS = Object.fromEntries(ALL_ELEMENTS.map((element) => [element, element]));

const STRAWBERRY_PHASES = {
  seedling: {
    label: "Рассада",
    ec: 1.0,
    ph: "5.6-6.0",
    targets: { N: 95, P: 28, K: 145, Ca: 80, Mg: 35, S: 45, Fe: 1.6, B: 0.28, Zn: 0.05, Cu: 0.03, Mn: 0.45, Mo: 0.04 }
  },
  vegetative: {
    label: "Вегетация",
    ec: 1.5,
    ph: "5.6-6.1",
    targets: { N: 145, P: 38, K: 210, Ca: 125, Mg: 45, S: 60, Fe: 2.0, B: 0.35, Zn: 0.06, Cu: 0.04, Mn: 0.55, Mo: 0.05 }
  },
  fruiting: {
    label: "Плодоношение",
    ec: 1.9,
    ph: "5.6-6.1",
    targets: { N: 175, P: 45, K: 260, Ca: 150, Mg: 55, S: 75, Fe: 2.2, B: 0.45, Zn: 0.07, Cu: 0.04, Mn: 0.65, Mo: 0.05 }
  }
};

const STRAWBERRY_RATIO_MATRIX = {
  seedling: {
    label: "Рассада",
    tendency: "мягкий вегетативный старт",
    ppm: { N: [70, 115], P: [20, 35], K: [110, 170], Ca: [70, 105], Mg: [28, 45] },
    ratios: { kToN: [1.2, 1.8], pToN: [0.22, 0.38], caToK: [0.45, 0.75], caToMg: [2.0, 3.6], kToMg: [3.2, 5.4] }
  },
  vegetative: {
    label: "Вегетация",
    tendency: "вегетативный рост",
    ppm: { N: [115, 170], P: [28, 45], K: [150, 230], Ca: [95, 145], Mg: [35, 55] },
    ratios: { kToN: [1.15, 1.7], pToN: [0.2, 0.36], caToK: [0.48, 0.85], caToMg: [2.25, 4.1], kToMg: [3.5, 5.7] }
  },
  fruiting: {
    label: "Плодоношение",
    tendency: "генеративный профиль",
    ppm: { N: [90, 145], P: [22, 48], K: [170, 280], Ca: [90, 155], Mg: [28, 58] },
    ratios: { kToN: [1.55, 2.6], pToN: [0.18, 0.42], caToK: [0.42, 0.78], caToMg: [2.25, 4.3], kToMg: [4.0, 7.5] }
  }
};

const FERTILIZERS = [
  {
    id: "calcinit-yara",
    name: "YaraLiva Calcinit",
    type: "Кальциевая селитра",
    category: "Кальций",
    meta: "Ca 19%, N 15.5%, нитрат кальция",
    aliases: ["кальциевая селитра", "нитрат кальция", "calcinit", "yara", "ca no3"],
    role: "calcium",
    tank: "A",
    composition: { N: 0.155, N_NO3: 0.144, N_NH4: 0.011, Ca: 0.19 }
  },
  {
    id: "calcium-nitrate-bhz",
    name: "Кальциевая селитра Буйская, марка А",
    type: "Кальциевая селитра",
    category: "Кальций",
    meta: "Ca 19%, N 15.5%",
    aliases: ["буйские", "бхз", "кальций азотнокислый", "нитрат кальция"],
    role: "calcium",
    tank: "A",
    default: true,
    composition: { N: 0.155, N_NO3: 0.144, N_NH4: 0.011, Ca: 0.19 }
  },
  {
    id: "calcium-nitrate-4h2o",
    name: "Кальций азотнокислый 4-водный, Ч",
    type: "Ca(NO3)2*4H2O",
    category: "Кальций",
    meta: "Ca 16.98%, N 11.86%",
    aliases: ["4 водный", "четырехводный", "ca(no3)2*4h2o", "нитрат кальция ч"],
    role: "calcium",
    tank: "A",
    composition: { N: 0.1186, N_NO3: 0.1186, N_NH4: 0, Ca: 0.1698 }
  },
  {
    id: "calcium-nitrate-anhydrous",
    name: "Кальций азотнокислый безводный, Ч",
    type: "Ca(NO3)2",
    category: "Кальций",
    meta: "Ca 24.4%, N 17.1%",
    aliases: ["безводный", "ca(no3)2", "нитрат кальция безводный"],
    role: "calcium",
    tank: "A",
    composition: { N: 0.1707, N_NO3: 0.1707, N_NH4: 0, Ca: 0.2442 }
  },
  {
    id: "haifa-cal",
    name: "Haifa Cal",
    type: "Кальциевая селитра",
    category: "Кальций",
    meta: "Ca 19%, N 15.5%",
    aliases: ["haifa cal", "хайфа кальций", "кальциевая селитра haifa", "нитрат кальция haifa"],
    role: "calcium",
    tank: "A",
    composition: { N: 0.155, N_NO3: 0.144, N_NH4: 0.011, Ca: 0.19 }
  },
  {
    id: "eurochem-aqualis-cn",
    name: "EuroChem Aqualis CN",
    type: "Кальциевая селитра",
    category: "Кальций",
    meta: "Ca 19%, N 15.5%",
    aliases: ["eurochem", "еврохим", "aqualis cn", "аквалис cn", "кальциевая селитра еврохим"],
    role: "calcium",
    tank: "A",
    composition: { N: 0.155, N_NO3: 0.144, N_NH4: 0.011, Ca: 0.19 }
  },
  {
    id: "potassium-nitrate-bhz",
    name: "Калиевая селитра Буйская",
    type: "KNO3",
    category: "Калий + азот",
    meta: "K 38.7%, N 13.9%",
    aliases: ["kno3", "нитрат калия", "калий азотнокислый", "буйские"],
    role: "potassiumNitrate",
    tank: "A",
    default: true,
    composition: { N: 0.1385, N_NO3: 0.1385, N_NH4: 0, K: 0.3867 }
  },
  {
    id: "potassium-nitrate-pure",
    name: "Калий азотнокислый, Ч",
    type: "KNO3",
    category: "Калий + азот",
    meta: "K 38.7%, N 13.9%, чистая соль",
    aliases: ["kno3", "нитрат калия", "калиевая селитра ч"],
    role: "potassiumNitrate",
    tank: "A",
    composition: { N: 0.1385, N_NO3: 0.1385, N_NH4: 0, K: 0.3867 }
  },
  {
    id: "yara-krista-k",
    name: "YaraTera KRISTA K",
    type: "KNO3",
    category: "Калий + азот",
    meta: "K 38.2%, N 13%, 13-0-46",
    aliases: ["yara", "яра", "krista k", "криста к", "нитрат калия yara", "калиевая селитра yara"],
    role: "potassiumNitrate",
    tank: "A",
    composition: { N: 0.13, N_NO3: 0.13, N_NH4: 0, K: 0.382 }
  },
  {
    id: "yara-krista-k-plus",
    name: "YaraTera KRISTA K Plus",
    type: "KNO3",
    category: "Калий + азот",
    meta: "K 38.4%, N 13.7%, 13.7-0-46.3",
    aliases: ["yara", "яра", "krista k plus", "криста к плюс", "нитрат калия yara"],
    role: "potassiumNitrate",
    tank: "A",
    composition: { N: 0.137, N_NO3: 0.137, N_NH4: 0, K: 0.384 }
  },
  {
    id: "haifa-multi-k-classic",
    name: "Haifa Multi-K Classic",
    type: "KNO3",
    category: "Калий + азот",
    meta: "K 38.2%, N 13%, 13-0-46",
    aliases: ["haifa", "хайфа", "multi-k", "мульти к", "multi k classic", "нитрат калия haifa"],
    role: "potassiumNitrate",
    tank: "A",
    composition: { N: 0.13, N_NO3: 0.13, N_NH4: 0, K: 0.382 }
  },
  {
    id: "haifa-multi-k-gg",
    name: "Haifa Multi-K GG",
    type: "KNO3",
    category: "Калий + азот",
    meta: "K 38.3%, N 13.5%, 13.5-0-46.2",
    aliases: ["haifa", "хайфа", "multi-k gg", "greenhouse grade", "нитрат калия haifa gg"],
    role: "potassiumNitrate",
    tank: "A",
    composition: { N: 0.135, N_NO3: 0.135, N_NH4: 0, K: 0.383 }
  },
  {
    id: "haifa-multi-k-absolute",
    name: "Haifa Multi-K Absolute",
    type: "KNO3",
    category: "Калий + азот",
    meta: "K 38.6%, N 13.8%, 13.8-0-46.5",
    aliases: ["haifa", "хайфа", "multi-k absolute", "hydroponics grade", "нитрат калия haifa absolute"],
    role: "potassiumNitrate",
    tank: "A",
    composition: { N: 0.138, N_NO3: 0.138, N_NH4: 0, K: 0.386 }
  },
  {
    id: "eurochem-aqualis-nop",
    name: "EuroChem Aqualis NOP solub",
    type: "KNO3",
    category: "Калий + азот",
    meta: "K 38.2%, N 13%, 13-0-46",
    aliases: ["eurochem", "еврохим", "aqualis nop", "аквалис nop", "нитрат калия еврохим"],
    role: "potassiumNitrate",
    tank: "A",
    composition: { N: 0.13, N_NO3: 0.13, N_NH4: 0, K: 0.382 }
  },
  {
    id: "monopotassium-phosphate-bhz",
    name: "Монофосфат калия Буйский 0-50-33",
    type: "KH2PO4",
    category: "Фосфор",
    meta: "P 21.8%, K 27.4%",
    aliases: ["монофосфат", "мкф", "kh2po4", "0-50-33", "фосфат калия"],
    role: "phosphate",
    tank: "B",
    default: true,
    composition: { P: 0.218, K: 0.274 }
  },
  {
    id: "monopotassium-phosphate-pure",
    name: "Монофосфат калия, Ч",
    type: "KH2PO4",
    category: "Фосфор",
    meta: "P 22.76%, K 28.73%",
    aliases: ["kh2po4", "мкф", "монофосфат чистый"],
    role: "phosphate",
    tank: "B",
    composition: { P: 0.2276, K: 0.2873 }
  },
  {
    id: "yara-krista-mkp",
    name: "YaraTera KRISTA MKP",
    type: "KH2PO4",
    category: "Фосфор",
    meta: "P 22.7%, K 28.2%, 0-52-34",
    aliases: ["yara", "яра", "krista mkp", "криста мкп", "монофосфат yara", "0-52-34"],
    role: "phosphate",
    tank: "B",
    composition: { P: 0.227, K: 0.282 }
  },
  {
    id: "haifa-mkp",
    name: "Haifa MKP",
    type: "KH2PO4",
    category: "Фосфор",
    meta: "P 22.7%, K 28.7%, 0-52-34",
    aliases: ["haifa", "хайфа", "haifa mkp", "мкп хайфа", "монофосфат haifa", "0-52-34"],
    role: "phosphate",
    tank: "B",
    composition: { P: 0.227, K: 0.287 }
  },
  {
    id: "eurochem-aqualis-map",
    name: "EuroChem Aqualis MAP solub",
    type: "NH4H2PO4",
    category: "Фосфор",
    meta: "P 26.6%, N 12%, 12-61-0",
    aliases: ["eurochem", "еврохим", "aqualis map", "аквалис map", "моноаммонийфосфат", "map", "12-61-0"],
    role: "phosphate",
    tank: "B",
    composition: { N: 0.12, N_NH4: 0.12, P: 0.266 }
  },
  {
    id: "urea-phosphate",
    name: "Фосфат карбамида, Ч",
    type: "CO(NH2)2*H3PO4",
    category: "Фосфор",
    meta: "P 19.4%, N 17.7%, кислый источник P",
    aliases: ["фосфат мочевины", "urea phosphate", "up", "фосфат карбамида", "карбамидфосфат"],
    role: "phosphate",
    tank: "B",
    composition: { N: 0.177, N_UREA: 0.177, P: 0.194 }
  },
  {
    id: "potassium-sulfate-solupotasse",
    name: "Сульфат калия Solupotasse",
    type: "K2SO4",
    category: "Калий + сера",
    meta: "K 41.5%, S 18%",
    aliases: ["сульфат калия", "сернокислый калий", "k2so4", "solupotasse"],
    role: "potassiumSulfate",
    tank: "B",
    composition: { K: 0.415, S: 0.18 }
  },
  {
    id: "potassium-sulfate-bhz",
    name: "Сульфат калия Буйский",
    type: "K2SO4",
    category: "Калий + сера",
    meta: "K 41.5%, S 18%",
    aliases: ["буйские", "бхз", "сульфат калия буйский", "сернокислый калий", "k2so4"],
    role: "potassiumSulfate",
    tank: "B",
    default: true,
    composition: { K: 0.415, S: 0.18 }
  },
  {
    id: "potassium-sulfate-pure",
    name: "Калий сернокислый, Ч",
    type: "K2SO4",
    category: "Калий + сера",
    meta: "K 44.9%, S 18.4%",
    aliases: ["сульфат калия ч", "k2so4", "сернокислый калий"],
    role: "potassiumSulfate",
    tank: "B",
    composition: { K: 0.449, S: 0.184 }
  },
  {
    id: "yara-krista-sop",
    name: "YaraTera KRISTA SOP",
    type: "K2SO4",
    category: "Калий + сера",
    meta: "K 42.3%, S 18%, 0-0-51 + 18S",
    aliases: ["yara", "яра", "krista sop", "криста sop", "сульфат калия yara", "0-0-51"],
    role: "potassiumSulfate",
    tank: "B",
    composition: { K: 0.423, S: 0.18 }
  },
  {
    id: "haifa-sop",
    name: "Haifa SOP",
    type: "K2SO4",
    category: "Калий + сера",
    meta: "K 42.3%, S 18%, 0-0-51",
    aliases: ["haifa", "хайфа", "haifa sop", "сульфат калия haifa", "0-0-51"],
    role: "potassiumSulfate",
    tank: "B",
    composition: { K: 0.423, S: 0.18 }
  },
  {
    id: "eurochem-aqualis-sop",
    name: "EuroChem Aqualis SOP solub",
    type: "K2SO4",
    category: "Калий + сера",
    meta: "K 43.2%, S 18%",
    aliases: ["eurochem", "еврохим", "aqualis sop", "аквалис sop", "сульфат калия еврохим"],
    role: "potassiumSulfate",
    tank: "B",
    composition: { K: 0.432, S: 0.18 }
  },
  {
    id: "magnesium-sulfate-7h2o-bhz",
    name: "Сульфат магния 7-водный Буйский",
    type: "MgSO4*7H2O",
    category: "Магний",
    meta: "Mg 9.86%, S 13%",
    aliases: ["сульфат магния", "магний сернокислый", "mgso4", "7 водный", "семиводный"],
    role: "magnesiumSulfate",
    tank: "B",
    default: true,
    composition: { Mg: 0.0986, S: 0.13 }
  },
  {
    id: "magnesium-sulfate-anhydrous",
    name: "Сульфат магния безводный, Ч",
    type: "MgSO4",
    category: "Магний",
    meta: "Mg 20.2%, S 26.6%",
    aliases: ["mgso4", "безводный", "магний сернокислый безводный"],
    role: "magnesiumSulfate",
    tank: "B",
    composition: { Mg: 0.202, S: 0.266 }
  },
  {
    id: "yara-krista-mgs",
    name: "YaraTera KRISTA MgS",
    type: "MgSO4*7H2O",
    category: "Магний",
    meta: "Mg 9.6%, S 12.8%, 16MgO + 32SO3",
    aliases: ["yara", "яра", "krista mgs", "криста mgs", "сульфат магния yara"],
    role: "magnesiumSulfate",
    tank: "B",
    composition: { Mg: 0.096, S: 0.128 }
  },
  {
    id: "magnesium-nitrate-6h2o",
    name: "Нитрат магния 6-водный",
    type: "Mg(NO3)2*6H2O",
    category: "Магний",
    meta: "Mg 9.5%, N 10.9%",
    aliases: ["нитрат магния", "магний азотнокислый", "mg(no3)2", "kristamag"],
    role: "magnesiumNitrate",
    tank: "A",
    composition: { N: 0.109, N_NO3: 0.109, N_NH4: 0, Mg: 0.095 }
  },
  {
    id: "haifa-magnisal",
    name: "Haifa Magnisal",
    type: "Mg(NO3)2*6H2O",
    category: "Магний",
    meta: "Mg 9.6%, N 11%, 11-0-0+16MgO",
    aliases: ["haifa", "хайфа", "magnisal", "магнисил", "нитрат магния haifa"],
    role: "magnesiumNitrate",
    tank: "A",
    composition: { N: 0.11, N_NO3: 0.11, N_NH4: 0, Mg: 0.096 }
  },
  {
    id: "ammonium-nitrate",
    name: "Аммоний азотнокислый",
    type: "NH4NO3",
    category: "Азот",
    meta: "N 35%, NO3/NH4",
    aliases: ["аммиачная селитра", "nh4no3", "нитрат аммония"],
    role: "nitrogen",
    tank: "A",
    composition: { N: 0.35, N_NO3: 0.175, N_NH4: 0.175 }
  },
  {
    id: "ammonium-sulfate",
    name: "Сульфат аммония",
    type: "(NH4)2SO4",
    category: "Азот + сера",
    meta: "N 21.2%, S 24.2%",
    aliases: ["аммоний сернокислый", "сульфат аммония", "(nh4)2so4"],
    role: "sulfateNitrogen",
    tank: "B",
    composition: { N: 0.212, N_NH4: 0.212, S: 0.242 }
  },
  {
    id: "fe-dtpa-11",
    name: "Хелат железа Fe DTPA 11%",
    type: "Fe DTPA",
    category: "Микро Fe",
    meta: "Fe 11%, бак B",
    aliases: ["fe dtpa", "железо дтпа", "хелат железа", "dtpa"],
    role: "micro",
    microElement: "Fe",
    tank: "B",
    default: true,
    composition: { Fe: 0.11 }
  },
  {
    id: "fe-eddha-6",
    name: "Хелат железа Fe EDDHA 6%",
    type: "Fe EDDHA",
    category: "Микро Fe",
    meta: "Fe 6%, для высокого pH",
    aliases: ["fe eddha", "железо еддха", "феррилен", "sequestrene"],
    role: "micro",
    microElement: "Fe",
    tank: "B",
    composition: { Fe: 0.06 }
  },
  {
    id: "boric-acid",
    name: "Борная кислота",
    type: "H3BO3",
    category: "Микро B",
    meta: "B 17.5%",
    aliases: ["бор", "борная", "h3bo3", "boric"],
    role: "micro",
    microElement: "B",
    tank: "B",
    default: true,
    composition: { B: 0.175 }
  },
  {
    id: "zn-edta-15",
    name: "Хелат цинка Zn EDTA 15%",
    type: "Zn EDTA",
    category: "Микро Zn",
    meta: "Zn 15%",
    aliases: ["zn edta", "цинк эдта", "хелат цинка"],
    role: "micro",
    microElement: "Zn",
    tank: "B",
    default: true,
    composition: { Zn: 0.15 }
  },
  {
    id: "cu-edta-15",
    name: "Хелат меди Cu EDTA 15%",
    type: "Cu EDTA",
    category: "Микро Cu",
    meta: "Cu 15%",
    aliases: ["cu edta", "медь эдта", "хелат меди"],
    role: "micro",
    microElement: "Cu",
    tank: "B",
    default: true,
    composition: { Cu: 0.15 }
  },
  {
    id: "mn-edta-13",
    name: "Хелат марганца Mn EDTA 13%",
    type: "Mn EDTA",
    category: "Микро Mn",
    meta: "Mn 13%",
    aliases: ["mn edta", "марганец эдта", "хелат марганца"],
    role: "micro",
    microElement: "Mn",
    tank: "B",
    default: true,
    composition: { Mn: 0.13 }
  },
  {
    id: "sodium-molybdate",
    name: "Молибдат натрия 2-водный",
    type: "Na2MoO4*2H2O",
    category: "Микро Mo",
    meta: "Mo 39.7%",
    aliases: ["молибден", "молибдат натрия", "na2moo4", "mo"],
    role: "micro",
    microElement: "Mo",
    tank: "B",
    default: true,
    composition: { Mo: 0.397 }
  },
  {
    id: "ammonium-molybdate",
    name: "Молибдат аммония",
    type: "(NH4)6Mo7O24",
    category: "Микро Mo",
    meta: "Mo около 54%",
    aliases: ["молибдат аммония", "молибден", "ammonium molybdate"],
    role: "micro",
    microElement: "Mo",
    tank: "B",
    composition: { Mo: 0.54 }
  },
  {
    id: "phosphoric-acid",
    name: "Ортофосфорная кислота",
    type: "H3PO4",
    category: "pH",
    meta: "pH-коррекция по щелочности",
    aliases: ["кислота", "фосфорная", "h3po4"],
    role: "acid",
    tank: "B",
    composition: {}
  },
  {
    id: "nitric-acid",
    name: "Азотная кислота 68%",
    type: "HNO3",
    category: "pH",
    meta: "pH-коррекция, добавляет N",
    aliases: ["кислота", "азотная", "hno3"],
    role: "acid",
    tank: "A",
    composition: {}
  }
];

const elements = {
  modeButtons: Array.from(document.querySelectorAll("[data-calc-mode]")),
  views: Array.from(document.querySelectorAll("[data-calc-view]")),
  inputs: Array.from(document.querySelectorAll("[data-nutrition-input]")),
  targetGrid: document.getElementById("nutrition-target-grid"),
  targetRatios: document.getElementById("nutrition-ratio-grid"),
  saltList: document.getElementById("nutrition-salt-list"),
  saltSearch: document.getElementById("nutrition-salt-search"),
  saltResults: document.getElementById("nutrition-salt-results"),
  phaseButtons: Array.from(document.querySelectorAll("[data-nutrition-phase]")),
  profileSelect: document.getElementById("nutrition-profile-select"),
  profileUpload: document.getElementById("nutrition-profile-upload"),
  profileStatus: document.getElementById("nutrition-profile-status"),
  uploadTrigger: document.querySelector("[data-nutrition-upload-trigger]"),
  templateButton: document.querySelector("[data-nutrition-template]"),
  saveProfileButton: document.querySelector("[data-nutrition-save-profile]"),
  resetButton: document.querySelector("[data-nutrition-reset]"),
  ecPreview: document.getElementById("nutrition-ec-preview"),
  ecDelta: document.getElementById("nutrition-ec-delta"),
  fitEcButton: document.querySelector("[data-nutrition-fit-ec]"),
  ecFactor: document.getElementById("nutrition-ec-factor"),
  volumeChip: document.getElementById("nutrition-volume-chip"),
  stockChip: document.getElementById("nutrition-stock-chip"),
  doseList: document.getElementById("nutrition-dose-list"),
  briefTextarea: document.querySelector("[data-calc-brief-text]")
};

let state = loadState();
let latestResult = null;
let manualEcFactor = null;

init();

function init() {
  if (!elements.targetGrid || !elements.saltList) return;
  renderTargetInputs(elements.targetGrid, ALL_ELEMENTS);
  bindEvents();
  render();

  if (isNutritionHash()) {
    setMode("nutrition", false);
    window.history.replaceState(null, "", buildRecipeHash());
    window.requestAnimationFrame(() => {
      document.getElementById("nutrition-calculator")?.scrollIntoView({ block: "start" });
    });
  }
}

function bindEvents() {
  elements.modeButtons.forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.calcMode, true));
  });

  window.addEventListener("hashchange", () => {
    const recipe = readRecipeFromUrl();
    if (recipe) {
      state = recipe;
      saveState(false);
      render();
    }
    if (isNutritionHash()) setMode("nutrition", false);
    if (window.location.hash === "#calculator-app") setMode("farm", false);
  });

  elements.phaseButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyBuiltInProfile(button.dataset.nutritionPhase);
    });
  });

  elements.profileSelect?.addEventListener("change", handleProfileSelect);
  elements.profileUpload?.addEventListener("change", handleProfileUpload);

  elements.inputs.forEach((input) => {
    input.addEventListener("input", handleInput);
    input.addEventListener("change", handleInput);
  });

  document.querySelectorAll("[data-nutrition-ec-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      state.sourceEc = positiveNumber(button.dataset.nutritionEcPreset, state.sourceEc);
      saveState();
      render();
    });
  });

  elements.targetGrid.addEventListener("input", handleTargetInput);

  elements.saltSearch?.addEventListener("input", () => renderSaltPicker());
  elements.saltResults?.addEventListener("click", handleSaltAdd);
  elements.saltList.addEventListener("click", handleSaltRemove);
  elements.doseList?.addEventListener("change", handleDoseInput);
  elements.doseList?.addEventListener("focusout", handleDoseInput);

  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-nutrition-fit-ec]")) return;
    event.preventDefault();
    fitMacroProfileToEc();
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-nutrition-upload-trigger]")) {
      event.preventDefault();
      elements.profileUpload?.click();
    }
    if (event.target.closest("[data-nutrition-template]")) {
      event.preventDefault();
      downloadProfileTemplate();
    }
    if (event.target.closest("[data-nutrition-save-profile]")) {
      event.preventDefault();
      saveCurrentProfileToCabinet();
    }
    const tankToggle = event.target.closest("[data-nutrition-toggle-tank]");
    if (tankToggle) {
      event.preventDefault();
      toggleFertilizerTank(tankToggle.dataset.nutritionToggleTank);
    }
    if (event.target.closest("[data-nutrition-auto-dose]")) {
      event.preventDefault();
      clearManualDoses();
      setProfileStatus("Авторасчет вернулся к профилю мг/л.");
      saveState();
      render();
    }
  });
  elements.ecFactor?.addEventListener("input", () => {
    manualEcFactor = getManualEcScaleFactor();
  });
  elements.ecFactor?.addEventListener("change", () => {
    manualEcFactor = getManualEcScaleFactor();
    elements.ecFactor.value = manualEcFactor ? formatFixed(manualEcFactor, 2) : "";
  });

  elements.resetButton?.addEventListener("click", () => {
    state = createDefaultState();
    saveState();
    render();
  });

}

function setMode(mode, writeHash) {
  const nextMode = mode === "nutrition" ? "nutrition" : "farm";
  document.body.classList.toggle("calc-mode-nutrition", nextMode === "nutrition");
  document.body.classList.toggle("calc-mode-farm", nextMode === "farm");
  document.title = nextMode === "nutrition"
    ? "Калькулятор раствора — Klubnika Project"
    : "Калькулятор фермы и питания — Klubnika Project";
  elements.modeButtons.forEach((button) => {
    const isActive = button.dataset.calcMode === nextMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  elements.views.forEach((view) => {
    view.hidden = view.dataset.calcView !== nextMode;
  });
  if (writeHash) {
    window.history.replaceState(null, "", nextMode === "nutrition" ? buildRecipeHash() : "#calculator-app");
  }
  if (nextMode === "nutrition") updateBriefField();
}

function isNutritionActive() {
  const nutritionView = elements.views.find((view) => view.dataset.calcView === "nutrition");
  return Boolean(nutritionView && !nutritionView.hidden);
}

function handleInput(event) {
  const input = event.currentTarget;
  const key = input.dataset.nutritionInput;
  if (!key) return;
  if (["volume", "stockRatio", "targetEc", "sourceEc"].includes(key)) {
    state[key] = positiveNumber(input.value, state[key]);
  } else {
    state[key] = input.value;
  }
  if (key === "volume" && isManualDoseMode()) syncTargetsFromManualDoses();
  saveState();
  render();
}

function handleTargetInput(event) {
  const input = event.target.closest("[data-nutrition-target]");
  if (!input) return;
  clearManualDoses();
  state.phase = "custom";
  state.targets[input.dataset.nutritionTarget] = positiveNumber(input.value, state.targets[input.dataset.nutritionTarget]);
  saveState();
  render();
}

function handleDoseInput(event) {
  const input = event.target.closest("[data-nutrition-dose]");
  if (!input) return;
  const fertilizerId = input.dataset.nutritionDose;
  const seedResult = latestResult || calculateNutrition();
  seedManualDoses(seedResult);
  state.manualDoses[fertilizerId] = positiveNumber(input.value, 0);
  syncTargetsFromManualDoses();
  setProfileStatus("Ручные граммы применены. Профиль пересчитан по навескам.");
  saveState();
  render();
}

function handleSaltAdd(event) {
  const button = event.target.closest("[data-nutrition-add-salt]");
  if (!button) return;
  const id = button.dataset.nutritionAddSalt;
  const fertilizer = FERTILIZERS.find((item) => item.id === id);
  if (!fertilizer) return;
  state.salts = state.salts.filter((currentId) => !shouldReplaceFertilizer(currentId, fertilizer));
  if (!state.salts.includes(id)) state.salts.push(id);
  if (isManualDoseMode()) {
    state.manualDoses = { ...(state.manualDoses || {}), [id]: positiveNumber(state.manualDoses?.[id], 0) };
    syncTargetsFromManualDoses();
  }
  elements.saltSearch.value = "";
  saveState();
  render();
}

function handleSaltRemove(event) {
  const button = event.target.closest("[data-nutrition-remove-salt]");
  if (!button) return;
  state.salts = state.salts.filter((id) => id !== button.dataset.nutritionRemoveSalt);
  if (isManualDoseMode() && state.manualDoses) {
    delete state.manualDoses[button.dataset.nutritionRemoveSalt];
    syncTargetsFromManualDoses();
  }
  if (state.tankOverrides) delete state.tankOverrides[button.dataset.nutritionRemoveSalt];
  saveState();
  render();
}

function render() {
  syncInputs();
  syncPhaseButtons();
  renderProfileOptions();
  renderTargetRatios();
  renderSaltPicker();
  latestResult = calculateNutrition();
  renderResult(latestResult);
  if (isNutritionActive()) updateBriefField();
}

function renderTargetInputs(container, elementList) {
  if (!container) return;
  container.innerHTML = elementList.map((element) => `
    <label class="nutrition-target-field">
      <span>${ELEMENT_LABELS[element]}</span>
      <input type="text" inputmode="decimal" data-nutrition-target="${element}" />
    </label>
  `).join("");
}

function renderTargetRatios() {
  if (!elements.targetRatios) return;
  const targets = normalizeTargets(state.targets);
  const ratioAnalysis = analyzeTargetRatios(targets);
  const items = [
    { label: "N:P:K", value: formatRatioSeries(["N", "P", "K"], targets), status: ratioAnalysis.statuses.npk },
    { label: "N:K", value: formatRatioPair("N", "K", targets), status: ratioAnalysis.statuses.kToN },
    { label: "N:Ca", value: formatRatioPair("N", "Ca", targets), status: ratioAnalysis.statuses.nToCa },
    { label: "K:Ca", value: formatRatioPair("K", "Ca", targets), status: ratioAnalysis.statuses.caToK },
    { label: "Ca:Mg", value: formatRatioPair("Ca", "Mg", targets), status: ratioAnalysis.statuses.caToMg },
    { label: "K:Mg", value: formatRatioPair("K", "Mg", targets), status: ratioAnalysis.statuses.kToMg }
  ];
  elements.targetRatios.innerHTML = items.map((item) => `
    <div class="nutrition-ratio-item ${item.status === "warning" ? "is-warning" : ""}">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
    </div>
  `).join("") + renderRatioComment(ratioAnalysis);
}

function renderRatioComment(analysis) {
  return `
    <div class="nutrition-ratio-comment ${analysis.level === "warning" ? "is-warning" : "is-ok"}">
      <strong>${escapeHtml(analysis.title)}</strong>
      <span>${escapeHtml(analysis.text)}</span>
    </div>
  `;
}

function analyzeTargetRatios(targets) {
  const values = getMacroValues(targets);
  if (!values.N || !values.K || !values.Ca || !values.Mg) {
    return {
      level: "warning",
      title: "Недостаточно данных",
      text: "Заполните N, K, Ca и Mg, чтобы увидеть оценку направленности профиля.",
      statuses: {}
    };
  }

  const ratios = getMacroRatios(values);
  const phaseKey = STRAWBERRY_RATIO_MATRIX[state.phase] ? state.phase : getClosestMatrixPhase(values, ratios);
  const closestPhaseKey = getClosestMatrixPhase(values, ratios);
  const matrix = STRAWBERRY_RATIO_MATRIX[phaseKey];
  const closestMatrix = STRAWBERRY_RATIO_MATRIX[closestPhaseKey];
  const ratioIssues = getRatioIssues(ratios, matrix);
  const ppmIssues = getPpmIssues(values, matrix);
  const issues = [...ppmIssues, ...ratioIssues].slice(0, 2);
  const statuses = getRatioStatuses(ratios, matrix);
  const titlePhase = closestPhaseKey !== phaseKey ? `ближе к ${closestMatrix.label}` : matrix.label;

  if (!issues.length) {
    return {
      level: "ok",
      title: `Профиль: ${titlePhase}`,
      text: `Соотношения: K/N ${formatRatioNumber(ratios.kToN)}, Ca/K ${formatRatioNumber(ratios.caToK)}, Ca/Mg ${formatRatioNumber(ratios.caToMg)}. Явных перекосов не видно.`,
      statuses
    };
  }

  return {
    level: "warning",
    title: `Профиль: ${titlePhase}`,
    text: `Проверить: ${issues.join("; ")}.`,
    statuses
  };
}

function getMacroValues(targets) {
  return {
    N: positiveNumber(targets.N, 0),
    P: positiveNumber(targets.P, 0),
    K: positiveNumber(targets.K, 0),
    Ca: positiveNumber(targets.Ca, 0),
    Mg: positiveNumber(targets.Mg, 0)
  };
}

function getMacroRatios(values) {
  return {
    kToN: values.N ? values.K / values.N : 0,
    pToN: values.N ? values.P / values.N : 0,
    caToK: values.K ? values.Ca / values.K : 0,
    caToMg: values.Mg ? values.Ca / values.Mg : 0,
    kToMg: values.Mg ? values.K / values.Mg : 0,
    nToCa: values.N ? values.Ca / values.N : 0
  };
}

function getClosestMatrixPhase(values, ratios) {
  return Object.entries(STRAWBERRY_RATIO_MATRIX).map(([key, matrix]) => ({
    key,
    score: scoreMatrixPhase(values, ratios, matrix)
  })).sort((a, b) => a.score - b.score)[0]?.key || "fruiting";
}

function scoreMatrixPhase(values, ratios, matrix) {
  const ratioScore = Object.entries(matrix.ratios).reduce((sum, [key, range]) => sum + rangeDistance(ratios[key], range), 0);
  const ppmScore = Object.entries(matrix.ppm).reduce((sum, [key, range]) => sum + rangeDistance(values[key], range) * 0.35, 0);
  return ratioScore + ppmScore;
}

function getRatioIssues(ratios, matrix) {
  return [
    getRangeIssue(ratios.kToN, matrix.ratios.kToN, "K/N", "K/N низкий", "K/N высокий"),
    getRangeIssue(ratios.pToN, matrix.ratios.pToN, "P/N", "P/N низкий", "P/N высокий"),
    getRangeIssue(ratios.caToK, matrix.ratios.caToK, "Ca/K", "Ca/K низкий", "Ca/K высокий"),
    getRangeIssue(ratios.caToMg, matrix.ratios.caToMg, "Ca/Mg", "Ca/Mg низкий", "Ca/Mg высокий"),
    getRangeIssue(ratios.kToMg, matrix.ratios.kToMg, "K/Mg", "K/Mg низкий", "K/Mg высокий")
  ].filter(Boolean);
}

function getPpmIssues(values, matrix) {
  return [
    getRangeIssue(values.N, matrix.ppm.N, "N", "N ниже профиля", "N выше профиля"),
    getRangeIssue(values.K, matrix.ppm.K, "K", "K ниже профиля", "K выше профиля"),
    getRangeIssue(values.Ca, matrix.ppm.Ca, "Ca", "Ca ниже профиля", "Ca выше профиля"),
    getRangeIssue(values.Mg, matrix.ppm.Mg, "Mg", "Mg ниже профиля", "Mg выше профиля")
  ].filter(Boolean);
}

function getRatioStatuses(ratios, matrix) {
  const status = (value, range) => isInRange(value, range) ? "ok" : "warning";
  return {
    npk: status(ratios.kToN, matrix.ratios.kToN) === "warning" || status(ratios.pToN, matrix.ratios.pToN) === "warning" ? "warning" : "ok",
    kToN: status(ratios.kToN, matrix.ratios.kToN),
    nToCa: status(ratios.nToCa, [0.7, 1.45]),
    caToK: status(ratios.caToK, matrix.ratios.caToK),
    caToMg: status(ratios.caToMg, matrix.ratios.caToMg),
    kToMg: status(ratios.kToMg, matrix.ratios.kToMg)
  };
}

function getRangeIssue(value, range, label, lowText, highText) {
  if (!Number.isFinite(value) || !range) return "";
  if (value < range[0]) return `${lowText} (${label} ${formatRatioNumber(value)})`;
  if (value > range[1]) return `${highText} (${label} ${formatRatioNumber(value)})`;
  return "";
}

function isInRange(value, range) {
  return Number.isFinite(value) && value >= range[0] && value <= range[1];
}

function rangeDistance(value, range) {
  if (!Number.isFinite(value) || !range) return 10;
  if (value >= range[0] && value <= range[1]) return 0;
  const center = (range[0] + range[1]) / 2;
  const width = Math.max((range[1] - range[0]) / 2, 0.001);
  return Math.abs(value - center) / width;
}

function syncInputs() {
  elements.inputs.forEach((input) => {
    const key = input.dataset.nutritionInput;
    if (!key || document.activeElement === input) return;
    input.value = state[key] ?? "";
  });

  ALL_ELEMENTS.forEach((element) => {
    const input = document.querySelector(`[data-nutrition-target="${element}"]`);
    if (input && document.activeElement !== input) input.value = formatElementValue(element, state.targets[element]);
  });

  document.querySelectorAll("[data-nutrition-ec-preset]").forEach((button) => {
    const value = positiveNumber(button.dataset.nutritionEcPreset, -1);
    button.classList.toggle("is-active", Math.abs(value - positiveNumber(state.sourceEc, 0)) < 0.001);
  });
}

function syncPhaseButtons() {
  elements.phaseButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.nutritionPhase === state.phase);
  });
  if (!elements.profileSelect || document.activeElement === elements.profileSelect) return;
  const value = STRAWBERRY_PHASES[state.phase] ? `phase:${state.phase}` : "custom";
  if (Array.from(elements.profileSelect.options).some((option) => option.value === value)) {
    elements.profileSelect.value = value;
  }
}

function renderProfileOptions() {
  if (!elements.profileSelect) return;
  const currentValue = elements.profileSelect.value || (STRAWBERRY_PHASES[state.phase] ? `phase:${state.phase}` : "custom");
  const cabinetProfiles = readCabinetProfiles();
  const phaseOptions = Object.entries(STRAWBERRY_PHASES).map(([key, profile]) => (
    `<option value="phase:${key}">${escapeHtml(profile.label)} - EC ${formatPlain(profile.ec)}</option>`
  )).join("");
  const cabinetOptions = cabinetProfiles.map((profile) => (
    `<option value="cabinet:${profile.id}">${escapeHtml(profile.name)}</option>`
  )).join("");
  elements.profileSelect.innerHTML = `
    <option value="custom">Текущий ручной профиль</option>
    <optgroup label="Клубника">${phaseOptions}</optgroup>
    ${cabinetOptions ? `<optgroup label="Кабинет">${cabinetOptions}</optgroup>` : ""}
  `;
  if (Array.from(elements.profileSelect.options).some((option) => option.value === currentValue)) {
    elements.profileSelect.value = currentValue;
  } else {
    elements.profileSelect.value = STRAWBERRY_PHASES[state.phase] ? `phase:${state.phase}` : "custom";
  }
}

function handleProfileSelect(event) {
  const value = event.target.value;
  if (value.startsWith("phase:")) {
    applyBuiltInProfile(value.replace("phase:", ""));
    return;
  }
  if (value.startsWith("cabinet:")) {
    const id = value.replace("cabinet:", "");
    const profile = readCabinetProfiles().find((item) => item.id === id);
    if (profile) applyProfile(profile, "Профиль из кабинета загружен.");
  }
}

function applyBuiltInProfile(key) {
  const phase = STRAWBERRY_PHASES[key];
  if (!phase) return;
  clearManualDoses();
  state.phase = key;
  state.targets = { ...phase.targets };
  state.targetEc = phase.ec;
  state.targetPh = phase.ph;
  setProfileStatus(`${phase.label}: профиль загружен.`);
  saveState();
  render();
}

function applyProfile(profile, message) {
  clearManualDoses();
  state.phase = profile.phase && STRAWBERRY_PHASES[profile.phase] ? profile.phase : "custom";
  state.targets = normalizeTargets(profile.targets || {});
  state.targetEc = positiveNumber(profile.targetEc, state.targetEc);
  state.targetPh = profile.targetPh || state.targetPh;
  setProfileStatus(message);
  saveState();
  render();
}

async function handleProfileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const profile = parseProfileText(text, file.name);
    if (!profile) {
      setProfileStatus("Не удалось прочитать профиль. Скачайте шаблон и заполните значения.");
      return;
    }
    applyProfile(profile, "Профиль загружен и сохранен в кабинет.");
    saveProfileToCabinet(profile);
    renderProfileOptions();
  } catch {
    setProfileStatus("Файл не прочитан. Для XLSX используйте шаблон Excel/CSV из калькулятора.");
  } finally {
    event.target.value = "";
  }
}

function downloadProfileTemplate() {
  const rows = [
    ["Параметр", "Значение"],
    ["Название", "Мой профиль питания"],
    ["Целевой EC", state.targetEc],
    ["Целевой pH", state.targetPh],
    ["", ""],
    ["Элемент", "мг/л"],
    ...ALL_ELEMENTS.map((element) => [element, state.targets[element] || 0])
  ];
  const html = `
    <html>
      <head><meta charset="utf-8"></head>
      <body>
        <table>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</table>
      </body>
    </html>
  `;
  downloadBlob(`profile-${new Date().toISOString().slice(0, 10)}.xls`, html, "application/vnd.ms-excel;charset=utf-8");
  setProfileStatus("Шаблон Excel скачан.");
}

function saveCurrentProfileToCabinet() {
  const phase = getPhase();
  const profile = {
    id: createProfileId(),
    name: `${phase.label} ${new Date().toLocaleDateString("ru-RU")}`,
    crop: "strawberry",
    phase: state.phase,
    targetEc: state.targetEc,
    targetPh: state.targetPh,
    targets: { ...state.targets },
    updatedAt: new Date().toISOString(),
    source: "calculator"
  };
  saveProfileToCabinet(profile);
  renderProfileOptions();
  elements.profileSelect.value = `cabinet:${profile.id}`;
  setProfileStatus("Профиль сохранен в кабинет.");
}

function saveProfileToCabinet(profile) {
  const profiles = readCabinetProfiles();
  const nextProfile = {
    ...profile,
    id: profile.id || createProfileId(),
    targets: normalizeTargets(profile.targets || {}),
    updatedAt: new Date().toISOString()
  };
  const nextProfiles = [nextProfile, ...profiles.filter((item) => item.id !== nextProfile.id)].slice(0, 20);
  try {
    window.localStorage.setItem(CABINET_PROFILE_KEY, JSON.stringify(nextProfiles));
  } catch {
    // Cabinet profile persistence is optional in local preview.
  }
}

function readCabinetProfiles() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CABINET_PROFILE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((profile) => profile && profile.targets) : [];
  } catch {
    return [];
  }
}

function parseProfileText(text, fileName) {
  const rows = text.includes("<table")
    ? parseHtmlTableRows(text)
    : parseDelimitedRows(text);
  if (!rows.length) return null;
  const profile = {
    id: createProfileId(),
    name: fileName.replace(/\.[^.]+$/, "") || "Загруженный профиль",
    crop: "strawberry",
    phase: "custom",
    targetEc: state.targetEc,
    targetPh: state.targetPh,
    targets: { ...state.targets },
    source: "upload"
  };
  rows.forEach((row) => {
    const key = String(row[0] || "").trim();
    const value = row[1];
    const normalizedKey = normalizeSearch(key);
    if (normalizedKey === "название" && value) profile.name = String(value).trim();
    if (normalizedKey.includes("целевой ec")) profile.targetEc = positiveNumber(value, profile.targetEc);
    if (normalizedKey.includes("целевой ph")) profile.targetPh = String(value || profile.targetPh).trim();
    const element = ALL_ELEMENTS.find((item) => item.toLowerCase() === key.toLowerCase());
    if (element) profile.targets[element] = positiveNumber(value, profile.targets[element]);
  });
  return profile;
}

function parseHtmlTableRows(text) {
  const documentFragment = new DOMParser().parseFromString(text, "text/html");
  return Array.from(documentFragment.querySelectorAll("tr")).map((row) => (
    Array.from(row.querySelectorAll("td,th")).map((cell) => cell.textContent.trim())
  )).filter((row) => row.length >= 2);
}

function parseDelimitedRows(text) {
  return text.split(/\r?\n/).map((line) => {
    const separator = line.includes(";") ? ";" : ",";
    return line.split(separator).map((cell) => cell.trim().replace(/^"|"$/g, ""));
  }).filter((row) => row.length >= 2);
}

function downloadBlob(fileName, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function createProfileId() {
  return `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function setProfileStatus(message) {
  if (elements.profileStatus) elements.profileStatus.textContent = message;
}

function renderSaltPicker() {
  const selected = selectedFertilizers();
  elements.saltList.innerHTML = selected.length
    ? `<div class="nutrition-selected-summary">Выбрано ${selected.length} источников. Баки A/B распределяются автоматически.</div>${groupByCategory(selected).map(renderSelectedGroup).join("")}`
    : `<div class="nutrition-warning">Введите профиль мг/л и добавьте источник через поиск. Калькулятор предложит расчет из выбранного набора.</div>`;

  const query = normalizeSearch(elements.saltSearch?.value || "");
  if (!query) {
    elements.saltResults.hidden = true;
    elements.saltResults.innerHTML = "";
    return;
  }

  elements.saltResults.hidden = false;
  const matches = searchFertilizers(query).filter((fertilizer) => !state.salts.includes(fertilizer.id)).slice(0, 8);
  elements.saltResults.innerHTML = matches.length
    ? matches.map(renderSearchResult).join("")
    : `<div class="nutrition-search-empty">Ничего не найдено. Попробуйте формулу или другое название.</div>`;
}

function renderSelectedGroup(group) {
  return `
    <div class="nutrition-selected-group">
      <div class="nutrition-selected-group-title">
        <span>${escapeHtml(group.category)}</span>
        <small>${group.items.length}</small>
      </div>
      <div class="nutrition-selected-items">
        ${group.items.map((fertilizer) => `
          <div class="nutrition-selected-salt">
            <div>
              <strong>${escapeHtml(fertilizer.name)}</strong>
              <span>${escapeHtml(fertilizer.type)} · бак ${getFertilizerTank(fertilizer)}</span>
            </div>
            <button type="button" data-nutrition-remove-salt="${fertilizer.id}" aria-label="Удалить ${escapeHtml(fertilizer.name)}">×</button>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderSearchResult(fertilizer) {
  const replacementText = getReplacementText(fertilizer);
  return `
    <button class="nutrition-search-result" type="button" data-nutrition-add-salt="${fertilizer.id}">
      <strong>${escapeHtml(fertilizer.name)}</strong>
      <span>${escapeHtml(fertilizer.type)} · ${escapeHtml(fertilizer.meta)} · ${escapeHtml(fertilizer.category)}</span>
      ${replacementText ? `<em>${escapeHtml(replacementText)}</em>` : ""}
    </button>
  `;
}

function calculateNutrition() {
  if (isManualDoseMode()) return calculateManualNutrition();

  const selected = new Set(state.salts);
  const sourceEc = positiveNumber(state.sourceEc, 0);
  const targets = normalizeTargets(state.targets);
  const totals = emptyElements();
  const doses = [];
  const warnings = [];

  const addDose = (fertilizer, mgL, reason) => {
    if (!fertilizer || !Number.isFinite(mgL) || mgL <= 0.0001) return;
    doses.push({
      fertilizer,
      mgL,
      grams: mgL * state.volume / 1000,
      tank: getFertilizerTank(fertilizer),
      reason
    });
    Object.entries(fertilizer.composition || {}).forEach(([element, fraction]) => {
      totals[element] = (totals[element] || 0) + mgL * fraction;
    });
  };

  const calcium = pickFertilizer(selected, "calcium");
  const phosphate = pickFertilizer(selected, "phosphate");
  const magnesiumSulfate = pickFertilizer(selected, "magnesiumSulfate");
  const magnesiumNitrate = pickFertilizer(selected, "magnesiumNitrate");
  const potassiumNitrate = pickFertilizer(selected, "potassiumNitrate");
  const potassiumSulfate = pickFertilizer(selected, "potassiumSulfate");
  const ammoniumNitrate = pickFertilizer(selected, "nitrogen");
  const ammoniumSulfate = pickFertilizer(selected, "sulfateNitrogen");

  if (calcium) addDose(calcium, targets.Ca / calcium.composition.Ca, "Ca");
  else if (targets.Ca > 5) warnings.push("Нет источника кальция. Добавьте кальциевую селитру или другой нитрат кальция.");

  if (phosphate) addDose(phosphate, targets.P / phosphate.composition.P, "P");
  else if (targets.P > 5) warnings.push("Нет источника фосфора. Добавьте монофосфат калия.");

  if (magnesiumSulfate) addDose(magnesiumSulfate, targets.Mg / magnesiumSulfate.composition.Mg, "Mg");
  else if (magnesiumNitrate) addDose(magnesiumNitrate, targets.Mg / magnesiumNitrate.composition.Mg, "Mg");
  else if (targets.Mg > 5) warnings.push("Нет источника магния. Добавьте сульфат или нитрат магния.");

  if (potassiumNitrate) {
    const remainingN = Math.max(0, targets.N - (totals.N || 0));
    const remainingK = Math.max(0, targets.K - (totals.K || 0));
    const byN = remainingN > 0 ? remainingN / potassiumNitrate.composition.N : Number.POSITIVE_INFINITY;
    const byK = remainingK > 0 ? remainingK / potassiumNitrate.composition.K : 0;
    addDose(potassiumNitrate, Math.min(byN, byK), "K/N");
  }

  if (potassiumSulfate) {
    const remainingK = Math.max(0, targets.K - (totals.K || 0));
    addDose(potassiumSulfate, remainingK / potassiumSulfate.composition.K, "K");
  }

  if (ammoniumNitrate) {
    const remainingN = Math.max(0, targets.N - (totals.N || 0));
    addDose(ammoniumNitrate, remainingN / ammoniumNitrate.composition.N, "N");
  }

  if (ammoniumSulfate) {
    const remainingS = Math.max(0, targets.S - (totals.S || 0));
    const currentN = totals.N || 0;
    if (remainingS > 4 && currentN < targets.N * 1.08) {
      addDose(ammoniumSulfate, remainingS / ammoniumSulfate.composition.S, "S");
    }
  }

  MICRO_ELEMENTS.forEach((element) => {
    const fertilizer = pickMicroFertilizer(selected, element);
    if (fertilizer) addDose(fertilizer, targets[element] / fertilizer.composition[element], element);
    else if (targets[element] > 0) warnings.push(`Нет источника ${element}. Добавьте отдельный хелат или соль микроэлемента.`);
  });

  const finalElements = emptyElements();
  ALL_ELEMENTS.forEach((element) => {
    finalElements[element] = totals[element] || 0;
  });

  const totalSaltMgL = doses.reduce((sum, dose) => sum + dose.mgL, 0);
  const fertilizerEc = doses
    .filter((dose) => !dose.fertilizer.microElement)
    .reduce((sum, dose) => sum + dose.mgL, 0) * 0.00085;
  const ec = sourceEc + fertilizerEc;
  const stockVolumeEach = state.volume / Math.max(1, state.stockRatio) / 2;
  const tankTotals = {
    A: doses.filter((dose) => dose.tank === "A").reduce((sum, dose) => sum + dose.grams, 0),
    B: doses.filter((dose) => dose.tank === "B").reduce((sum, dose) => sum + dose.grams, 0)
  };
  const deviations = buildDeviations(targets, finalElements);
  const nh4 = totals.N_NH4 || 0;
  const nh4Percent = finalElements.N > 0 ? nh4 / finalElements.N * 100 : 0;

  warnings.push(...buildWarnings({ targets, finalElements, deviations, ec, nh4Percent, sourceEc, selected, doses }));

  return {
    phase: getPhase(),
    sourceEc,
    fertilizerEc,
    targets,
    finalElements,
    deviations,
    doses,
    warnings: unique(warnings),
    ec,
    nh4Percent,
    totalSaltMgL,
    stockVolumeEach,
    tankTotals
  };
}

function calculateManualNutrition() {
  const sourceEc = positiveNumber(state.sourceEc, 0);
  const targets = normalizeTargets(state.targets);
  const totals = emptyElements();
  const doses = [];
  const warnings = [];
  const manualDoses = normalizeManualDoses(state.manualDoses);

  selectedFertilizers().forEach((fertilizer) => {
    const grams = positiveNumber(manualDoses[fertilizer.id], 0);
    const mgL = state.volume > 0 ? grams * 1000 / state.volume : 0;
    doses.push({
      fertilizer,
      mgL,
      grams,
      tank: getFertilizerTank(fertilizer),
      reason: "ручной вес",
      manual: true
    });
    Object.entries(fertilizer.composition || {}).forEach(([element, fraction]) => {
      totals[element] = (totals[element] || 0) + mgL * fraction;
    });
  });

  const finalElements = emptyElements();
  ALL_ELEMENTS.forEach((element) => {
    finalElements[element] = totals[element] || 0;
  });

  const totalSaltMgL = doses.reduce((sum, dose) => sum + dose.mgL, 0);
  const fertilizerEc = doses
    .filter((dose) => !dose.fertilizer.microElement)
    .reduce((sum, dose) => sum + dose.mgL, 0) * 0.00085;
  const ec = sourceEc + fertilizerEc;
  const stockVolumeEach = state.volume / Math.max(1, state.stockRatio) / 2;
  const tankTotals = {
    A: doses.filter((dose) => dose.tank === "A").reduce((sum, dose) => sum + dose.grams, 0),
    B: doses.filter((dose) => dose.tank === "B").reduce((sum, dose) => sum + dose.grams, 0)
  };
  const deviations = buildDeviations(targets, finalElements);
  const nh4 = totals.N_NH4 || 0;
  const nh4Percent = finalElements.N > 0 ? nh4 / finalElements.N * 100 : 0;

  warnings.push(...buildWarnings({ targets, finalElements, deviations, ec, nh4Percent, sourceEc, selected: new Set(state.salts), doses }));

  return {
    mode: "manual",
    phase: getPhase(),
    sourceEc,
    fertilizerEc,
    targets,
    finalElements,
    deviations,
    doses,
    warnings: unique(warnings),
    ec,
    nh4Percent,
    totalSaltMgL,
    stockVolumeEach,
    tankTotals
  };
}

function isManualDoseMode() {
  return state.doseMode === "manual" && state.manualDoses && typeof state.manualDoses === "object";
}

function clearManualDoses() {
  state.doseMode = "auto";
  state.manualDoses = {};
}

function seedManualDoses(result) {
  if (!isManualDoseMode()) {
    state.doseMode = "manual";
    state.manualDoses = {};
    (result?.doses || []).forEach((dose) => {
      state.manualDoses[dose.fertilizer.id] = roundToStep(dose.grams, dose.grams < 1 ? 0.001 : 0.1);
    });
  }
  selectedFertilizers().forEach((fertilizer) => {
    if (!Object.prototype.hasOwnProperty.call(state.manualDoses, fertilizer.id)) {
      state.manualDoses[fertilizer.id] = 0;
    }
  });
}

function syncTargetsFromManualDoses() {
  if (!isManualDoseMode()) return;
  const result = calculateManualNutrition();
  state.targets = normalizeTargets(result.finalElements);
  state.phase = "custom";
}

function normalizeManualDoses(doses) {
  return Object.fromEntries(Object.entries(doses || {}).map(([id, grams]) => [id, positiveNumber(grams, 0)]));
}

function normalizeTankOverrides(overrides) {
  return Object.fromEntries(Object.entries(overrides || {}).filter(([id, tank]) => {
    const fertilizer = FERTILIZERS.find((item) => item.id === id);
    return canToggleTank(fertilizer) && (tank === "A" || tank === "B");
  }));
}

function canToggleTank(fertilizer) {
  return fertilizer?.role === "potassiumNitrate";
}

function getFertilizerTank(fertilizer) {
  const override = state.tankOverrides?.[fertilizer.id];
  return override === "B" || override === "A" ? override : fertilizer.tank;
}

function toggleFertilizerTank(fertilizerId) {
  const fertilizer = FERTILIZERS.find((item) => item.id === fertilizerId);
  if (!canToggleTank(fertilizer)) return;
  const currentTank = getFertilizerTank(fertilizer);
  state.tankOverrides = { ...(state.tankOverrides || {}), [fertilizerId]: currentTank === "A" ? "B" : "A" };
  setProfileStatus(`${fertilizer.name}: перенесено в бак ${state.tankOverrides[fertilizerId]}.`);
  saveState();
  render();
}

function renderResult(result) {
  if (elements.ecPreview) elements.ecPreview.textContent = formatFixed(result.ec, 2);
  if (elements.ecDelta) {
    const delta = result.ec - state.targetEc;
    const sign = delta >= 0 ? "+" : "";
    elements.ecDelta.textContent = `цель ${formatPlain(state.targetEc)}, ${sign}${formatFixed(delta, 2)}`;
    elements.ecDelta.classList.toggle("is-high", delta > 0.15);
    elements.ecDelta.classList.toggle("is-low", delta < -0.15);
  }
  if (elements.ecFactor) {
    const factor = getEcScaleFactor(result);
    if (document.activeElement !== elements.ecFactor && manualEcFactor === null) {
      elements.ecFactor.value = factor ? formatFixed(factor, 2) : "";
    }
  }
  if (elements.volumeChip) elements.volumeChip.textContent = `${formatPlain(state.volume)} л`;
  if (elements.stockChip) elements.stockChip.textContent = `${formatFixed(result.stockVolumeEach, 1)} л + ${formatFixed(result.stockVolumeEach, 1)} л`;

  elements.doseList.innerHTML = result.doses.length
    ? renderDoseGroups(result)
    : `<div class="nutrition-warning">Введите профиль мг/л и добавьте источники удобрений через поиск.</div>`;
}

function renderDoseGroups(result) {
  const { doses, tankTotals } = result;
  const tankA = doses.filter((dose) => dose.tank === "A");
  const tankB = doses.filter((dose) => dose.tank === "B");
  return `
    ${renderDoseMode(result)}
    <div class="nutrition-dose-columns">
      ${renderDoseGroup("Бак A", "Не смешивать с баком B в концентрате.", tankA)}
      ${renderDoseGroup("Бак B", "Растворять отдельно после бака A.", tankB)}
    </div>
    <div class="nutrition-dose-overview">
      ${renderTankTotal("Бак A", "кальций и нитратные соли", tankTotals.A)}
      ${renderTankTotal("Бак B", "фосфаты, сульфаты, микро", tankTotals.B)}
    </div>
  `;
}

function renderDoseMode(result) {
  const isManual = result.mode === "manual";
  return `
    <div class="nutrition-dose-mode ${isManual ? "is-manual" : "is-auto"}">
      <span>${isManual ? "Ручные граммы" : "Авторасчет"}</span>
      <strong>${isManual ? "профиль пересчитан по навескам" : "граммы рассчитаны по профилю мг/л"}</strong>
      ${isManual ? `<button type="button" data-nutrition-auto-dose>Вернуть авторасчет</button>` : ""}
    </div>
  `;
}

function renderTankTotal(title, hint, grams) {
  return `
    <div class="nutrition-tank-total">
      <span>${escapeHtml(title)}</span>
      <strong>${formatFixed(grams, 1)} г</strong>
      <small>${escapeHtml(hint)}</small>
    </div>
  `;
}

function renderDoseGroup(title, hint, doses) {
  return `
    <div class="nutrition-dose-group">
      <div class="nutrition-dose-group-head">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(hint)}</span>
      </div>
      <div class="nutrition-dose-items">
        ${doses.length ? doses.map(renderDoseRow).join("") : `<div class="nutrition-warning">Для этого бака солей нет.</div>`}
      </div>
    </div>
  `;
}

function renderDoseRow(dose) {
  const digits = dose.grams < 1 ? 3 : 1;
  const nextTank = dose.tank === "A" ? "B" : "A";
  return `
    <div class="nutrition-dose-row">
      <div class="nutrition-dose-copy">
        <strong>${escapeHtml(dose.fertilizer.name)}</strong>
        <span>${escapeHtml(dose.fertilizer.type)} · ${escapeHtml(dose.reason)}</span>
      </div>
      <div class="nutrition-dose-actions">
        ${canToggleTank(dose.fertilizer) ? `<button class="nutrition-dose-tank-button" type="button" data-nutrition-toggle-tank="${escapeHtml(dose.fertilizer.id)}">В бак ${nextTank}</button>` : ""}
        <label class="nutrition-dose-amount">
          <input type="text" inputmode="decimal" data-nutrition-dose="${escapeHtml(dose.fertilizer.id)}" value="${formatFixed(dose.grams, digits)}" aria-label="Граммы ${escapeHtml(dose.fertilizer.name)}" />
          <span>г</span>
        </label>
      </div>
    </div>
  `;
}

function buildWarnings(context) {
  const warnings = [];
  const { targets, deviations, ec, nh4Percent, sourceEc, doses } = context;
  deviations.forEach((item) => {
    const limit = MICRO_ELEMENTS.includes(item.element) ? 25 : 12;
    const minTarget = MICRO_ELEMENTS.includes(item.element) ? 0.01 : 20;
    if (Math.abs(item.percent) > limit && item.target > minTarget) {
      warnings.push(`По ${item.element} рецепт отличается от пресета на ${item.percent > 0 ? "+" : ""}${formatFixed(item.percent, 0)}%. Сверьте перед внесением.`);
    }
  });
  if (Math.abs(ec - state.targetEc) > 0.35) {
    warnings.push(`Расчетный EC ${formatFixed(ec, 2)} отличается от цели ${formatPlain(state.targetEc)}. Проверьте концентрацию по прибору.`);
  }
  if (nh4Percent > 8) warnings.push(`Аммонийная форма азота около ${formatFixed(nh4Percent, 1)}%. Для клубники это лучше держать под контролем.`);
  const hasCalcium = doses.some((dose) => dose.tank === "A" && dose.fertilizer.role === "calcium");
  const hasPhosphateOrSulfate = doses.some((dose) => dose.tank === "B" && ["phosphate", "magnesiumSulfate", "potassiumSulfate"].includes(dose.fertilizer.role));
  if (hasCalcium && hasPhosphateOrSulfate) warnings.push("Кальций не смешивать в одном концентрате с фосфатами и сульфатами: держите бак A и бак B отдельно.");
  if (sourceEc >= 0.8) warnings.push("Исходный EC воды высокий. Без анализа воды рецепт стоит отправить на проверку: Ca, Mg, Na и бикарбонаты могут менять питание.");
  if (sourceEc >= 1.2) warnings.push("EC воды выше 1.2 мСм/см: для клубники это уже риск. Лучше не вносить рецепт без анализа воды.");
  if ((context.finalElements.S || 0) > targets.S * 1.35 && targets.S > 0) warnings.push("Сера заметно выше цели. Часто причина в сульфате магния и сульфате калия одновременно.");
  return warnings;
}

function fitMacroProfileToEc() {
  const result = latestResult || calculateNutrition();
  const factor = manualEcFactor || getManualEcScaleFactor() || getEcScaleFactor(result);
  if (!factor) return;
  clearManualDoses();
  MACRO_ELEMENTS.forEach((element) => {
    state.targets[element] = roundToStep((state.targets[element] || 0) * factor, 1);
  });
  state.phase = "custom";
  manualEcFactor = null;
  saveState();
  render();
}

function getManualEcScaleFactor() {
  const parsed = positiveNumber(elements.ecFactor?.value, 0);
  return parsed > 0 ? clamp(parsed, 0.25, 2.5) : null;
}

function getEcScaleFactor(result) {
  const currentFertilizerEc = result.ec - result.sourceEc;
  const targetFertilizerEc = state.targetEc - state.sourceEc;
  if (!Number.isFinite(currentFertilizerEc) || !Number.isFinite(targetFertilizerEc) || currentFertilizerEc <= 0 || targetFertilizerEc <= 0) {
    return null;
  }
  return clamp(targetFertilizerEc / currentFertilizerEc, 0.25, 2.5);
}

function buildBriefText(result) {
  const doseLines = result.doses.map((dose) => (
    `- Бак ${dose.tank}: ${dose.fertilizer.name} - ${formatFixed(dose.grams, dose.grams < 1 ? 3 : 1)} г (${formatFixed(dose.mgL, 3)} мг/л)`
  ));
  const ppmLine = ALL_ELEMENTS.map((element) => `${element} ${formatFixed(result.finalElements[element], MICRO_ELEMENTS.includes(element) ? 2 : 0)}/${formatFixed(result.targets[element], MICRO_ELEMENTS.includes(element) ? 2 : 0)}`).join(", ");
  const warningLines = result.warnings.map((warning) => `- ${warning}`);
  return [
    "Калькулятор питания Klubnika Project",
    `Ссылка на рецепт: ${buildRecipeUrl()}`,
    `Культура: клубника`,
    `Фаза: ${result.phase.label}`,
    `Рабочий раствор: ${formatPlain(state.volume)} л`,
    `EC воды: ${formatPlain(result.sourceEc)} мСм/см`,
    `Цель: EC ${formatPlain(state.targetEc)}, pH ${state.targetPh}`,
    `Концентрат: 1 к ${formatPlain(state.stockRatio)}; A/B по ${formatFixed(result.stockVolumeEach, 1)} л`,
    `Итог мг/л: ${ppmLine}`,
    `Расчетный EC: ${formatFixed(result.ec, 2)} мСм/см`,
    "",
    "Удобрения:",
    ...(doseLines.length ? doseLines : ["- удобрения не выбраны"]),
    "",
    "Предупреждения:",
    ...(warningLines.length ? warningLines : ["- явных расчетных конфликтов не видно"]),
    state.notes ? `\nЗаметки: ${state.notes}` : ""
  ].filter((line) => line !== "").join("\n");
}

function updateBriefField(text = buildBriefText(latestResult || calculateNutrition())) {
  if (!elements.briefTextarea) return;
  elements.briefTextarea.value = text;
  try {
    window.localStorage.setItem("klubnikaproject.calc.brief.v1", JSON.stringify({
      updatedAt: new Date().toISOString(),
      text,
      source: "nutrition"
    }));
  } catch {
    // localStorage is optional for this handoff field.
  }
}

function getPhase() {
  return STRAWBERRY_PHASES[state.phase] || {
    label: "Ручной рецепт",
    ec: state.targetEc,
    ph: state.targetPh,
    targets: state.targets
  };
}

function createDefaultState() {
  const phase = STRAWBERRY_PHASES.fruiting;
  return {
    crop: "strawberry",
    phase: "fruiting",
    volume: 500,
    stockRatio: 250,
    sourceEc: 0.3,
    targetEc: phase.ec,
    targetPh: phase.ph,
    notes: "",
    targets: { ...phase.targets },
    salts: FERTILIZERS.filter((fertilizer) => fertilizer.default).map((fertilizer) => fertilizer.id),
    doseMode: "auto",
    manualDoses: {},
    tankOverrides: {}
  };
}

function loadState() {
  const fromUrl = readRecipeFromUrl();
  if (fromUrl) return fromUrl;
  const fallback = createDefaultState();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    if (!parsed) return fallback;
    return normalizeState({ ...fallback, ...parsed });
  } catch {
    return fallback;
  }
}

function saveState(updateUrl = true) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Persisting this calculator is helpful but not required.
  }
  if (updateUrl && isNutritionHash()) {
    window.history.replaceState(null, "", buildRecipeHash());
  }
}

function normalizeState(raw) {
  const fallback = createDefaultState();
  const isCustomPhase = raw.phase === "custom";
  const knownPhase = STRAWBERRY_PHASES[raw.phase];
  const phase = knownPhase || STRAWBERRY_PHASES.fruiting;
  const salts = Array.isArray(raw.salts) ? raw.salts.filter((id) => FERTILIZERS.some((fertilizer) => fertilizer.id === id)) : fallback.salts;
  return {
    ...fallback,
    ...raw,
    phase: knownPhase ? raw.phase : (isCustomPhase ? "custom" : fallback.phase),
    volume: positiveNumber(raw.volume, fallback.volume),
    stockRatio: positiveNumber(raw.stockRatio, fallback.stockRatio),
    sourceEc: positiveNumber(raw.sourceEc ?? raw.waterEc, fallback.sourceEc),
    targetEc: positiveNumber(raw.targetEc, phase.ec),
    targetPh: raw.targetPh || phase.ph,
    targets: normalizeTargets({ ...phase.targets, ...(raw.targets || {}) }),
    salts: salts.length ? cleanSaltSelection(salts) : fallback.salts,
    doseMode: raw.doseMode === "manual" ? "manual" : "auto",
    manualDoses: normalizeManualDoses(raw.manualDoses),
    tankOverrides: normalizeTankOverrides(raw.tankOverrides)
  };
}

function buildRecipeHash() {
  return `#nutrition-calculator?r=${encodeRecipe(state)}`;
}

function buildRecipeUrl() {
  return `${window.location.origin}${window.location.pathname}${buildRecipeHash()}`;
}

function readRecipeFromUrl() {
  const match = window.location.hash.match(/[?&]r=([^&]+)/);
  if (!match) return null;
  try {
    return normalizeState(JSON.parse(decodeURIComponent(escape(window.atob(match[1])))));
  } catch {
    return null;
  }
}

function encodeRecipe(recipeState) {
  const compact = {
    v: 1,
    crop: recipeState.crop,
    phase: recipeState.phase,
    volume: recipeState.volume,
    stockRatio: recipeState.stockRatio,
    sourceEc: recipeState.sourceEc,
    targetEc: recipeState.targetEc,
    targetPh: recipeState.targetPh,
    targets: recipeState.targets,
    salts: recipeState.salts,
    notes: recipeState.notes,
    doseMode: recipeState.doseMode === "manual" ? "manual" : "auto",
    manualDoses: recipeState.doseMode === "manual" ? normalizeManualDoses(recipeState.manualDoses) : {},
    tankOverrides: normalizeTankOverrides(recipeState.tankOverrides)
  };
  return window.btoa(unescape(encodeURIComponent(JSON.stringify(compact))));
}

function isNutritionHash() {
  return window.location.hash === "#nutrition" || window.location.hash.startsWith("#nutrition-calculator");
}

function selectedFertilizers() {
  return state.salts.map((id) => FERTILIZERS.find((fertilizer) => fertilizer.id === id)).filter(Boolean);
}

function getReplacementText(nextFertilizer) {
  const current = selectedFertilizers().find((fertilizer) => shouldReplaceFertilizer(fertilizer.id, nextFertilizer));
  if (!current) return "";
  return `Заменит: ${current.name}`;
}

function cleanSaltSelection(ids) {
  return ids.reduce((result, id) => {
    const fertilizer = FERTILIZERS.find((item) => item.id === id);
    if (!fertilizer) return result;
    return [...result.filter((currentId) => !shouldReplaceFertilizer(currentId, fertilizer)), id];
  }, []);
}

function searchFertilizers(query) {
  if (!query) {
    return FERTILIZERS.filter((fertilizer) => fertilizer.default || fertilizer.category.includes("Кальций")).slice(0, 8);
  }
  return FERTILIZERS
    .map((fertilizer) => ({ fertilizer, score: scoreFertilizer(fertilizer, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.fertilizer.name.localeCompare(b.fertilizer.name, "ru"))
    .map((item) => item.fertilizer);
}

function scoreFertilizer(fertilizer, query) {
  const haystack = normalizeSearch([fertilizer.name, fertilizer.type, fertilizer.category, fertilizer.meta, ...(fertilizer.aliases || [])].join(" "));
  const parts = query.split(/\s+/).filter(Boolean);
  if (!parts.length) return 0;
  if (!parts.every((part) => haystack.includes(part))) return 0;
  return parts.reduce((score, part) => {
    if (haystack.includes(part)) return score + (haystack.startsWith(part) ? 4 : 2);
    return score;
  }, 0);
}

function normalizeSearch(value) {
  return String(value || "").toLowerCase().replace(/[ё]/g, "е").replace(/[^a-zа-я0-9%+*().-]+/gi, " ").trim();
}

function groupByCategory(items) {
  const groups = [];
  items.forEach((item) => {
    const category = item.category.startsWith("Микро") ? "Микроэлементы" : item.category;
    let group = groups.find((candidate) => candidate.category === category);
    if (!group) {
      group = { category, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  });
  return groups;
}

function pickFertilizer(selected, role) {
  return FERTILIZERS.find((fertilizer) => selected.has(fertilizer.id) && fertilizer.role === role);
}

function pickMicroFertilizer(selected, element) {
  return FERTILIZERS.find((fertilizer) => selected.has(fertilizer.id) && fertilizer.role === "micro" && fertilizer.microElement === element);
}

function shouldReplaceFertilizer(currentId, nextFertilizer) {
  if (currentId === nextFertilizer.id) return false;
  const current = FERTILIZERS.find((fertilizer) => fertilizer.id === currentId);
  if (!current || current.role === "acid" || nextFertilizer.role === "acid") return false;
  if (current.microElement || nextFertilizer.microElement) {
    return current.microElement && current.microElement === nextFertilizer.microElement;
  }
  return current.role === nextFertilizer.role;
}

function normalizeTargets(targets) {
  return ALL_ELEMENTS.reduce((result, element) => {
    result[element] = Math.max(0, positiveNumber(targets[element], 0));
    return result;
  }, {});
}

function emptyElements() {
  return { N: 0, P: 0, K: 0, Ca: 0, Mg: 0, S: 0, Fe: 0, B: 0, Zn: 0, Cu: 0, Mn: 0, Mo: 0, N_NO3: 0, N_NH4: 0 };
}

function buildDeviations(targets, finalElements) {
  return ALL_ELEMENTS.map((element) => {
    const target = targets[element] || 0;
    const value = finalElements[element] || 0;
    return { element, target, value, percent: target > 0 ? (value - target) / target * 100 : 0 };
  });
}

function positiveNumber(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(",", ".").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundToStep(value, step) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value / step) * step;
}

function formatFixed(value, digits = 1) {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatRatioPair(firstElement, secondElement, targets) {
  const firstValue = positiveNumber(targets[firstElement], 0);
  const secondValue = positiveNumber(targets[secondElement], 0);
  if (!firstValue || !secondValue) return "—";
  return `1:${formatRatioNumber(secondValue / firstValue)}`;
}

function formatRatioSeries(elementList, targets) {
  const baseValue = positiveNumber(targets[elementList[0]], 0);
  if (!baseValue) return "—";
  return elementList.map((element) => {
    const value = positiveNumber(targets[element], 0);
    return value ? formatRatioNumber(value / baseValue) : "0";
  }).join(":");
}

function formatRatioNumber(value) {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function formatPlain(value) {
  if (!Number.isFinite(Number(value))) return String(value ?? "");
  return Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function formatElementValue(element, value) {
  if (!Number.isFinite(Number(value))) return String(value ?? "");
  const digits = MICRO_ELEMENTS.includes(element) ? 2 : 0;
  return Number(value).toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function capitalize(value) {
  const text = String(value || "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

function unique(items) {
  return Array.from(new Set(items.filter(Boolean)));
}
