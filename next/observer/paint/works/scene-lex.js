/**
 * Free-text prompt → scene plan. Pure functions, no p5, no network.
 * A big hand-built vocabulary (subjects, places, time, weather, moods,
 * colours, emoji) plus a deterministic hash for every word it doesn't know,
 * so any prompt — "my dog eating pizza on the moon", "finals week", "🍕",
 * "zxqv" — gets its own painting.
 */

/* ---------------- colour helpers ---------------- */

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
function mixHex(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
function hslHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}
function strHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return h >>> 0;
}

/* ---------------- named colours ---------------- */

const NAMED_COLORS = {
  red: "#c13b4a", crimson: "#a33b4a", scarlet: "#c8372d", cherry: "#b0263a", ruby: "#9b1b30",
  maroon: "#6e2230", burgundy: "#6b2134", wine: "#722f37", brick: "#a5513f", rust: "#a8532f",
  orange: "#e98a3a", tangerine: "#f08a2c", amber: "#e9a23b", apricot: "#f4b183", peach: "#f6c9a4",
  coral: "#e88972", salmon: "#ee9a83", pink: "#e59bb3", rose: "#d77a92", blush: "#efb8c0",
  magenta: "#c94f9a", fuchsia: "#c74ba0", hotpink: "#e0609a", bubblegum: "#f19cc4",
  yellow: "#f3d660", gold: "#e1b83f", golden: "#e1b83f", lemon: "#f2e15a", mustard: "#cfa33a",
  butter: "#f5e3a0", honey: "#e3a94a", cream: "#f4ead0", ivory: "#f6f0dc", beige: "#e3d3b5",
  tan: "#c9a77c", sand: "#dcc394", khaki: "#b9ad7e", brown: "#8a5a3c", chocolate: "#5e3a26",
  coffee: "#6f4e37", caramel: "#b9783f", bronze: "#a8743a", copper: "#b8693e",
  green: "#5d8a4a", lime: "#a6cf4f", olive: "#7b8a45", mint: "#a8d8b9", sage: "#9db191",
  emerald: "#2f8f68", jade: "#3e9e7a", forest: "#2f5a35", moss: "#6f7d3c", teal: "#2f8a8a",
  turquoise: "#3fbfb7", aqua: "#5fd0d0", cyan: "#58c9e0", seafoam: "#8fd6c0",
  blue: "#3a6cb8", sky: "#8cc1e6", skyblue: "#8cc1e6", baby: "#a9cdee", navy: "#1f2a5c",
  cobalt: "#2a4fa8", azure: "#4a90d9", sapphire: "#25438f", indigo: "#33337a", denim: "#4a6a9a",
  periwinkle: "#8f9be0", cornflower: "#6f8fd8",
  purple: "#7a4a9a", violet: "#7d5ab0", lavender: "#b8a6dc", lilac: "#c3a3d6", plum: "#7b3f6e",
  mauve: "#b0839e", grape: "#6a3d8a", orchid: "#c47fc0", amethyst: "#8a63b8",
  white: "#fbf8f0", snow: "#f6f8fb", pearl: "#eee8dc", silver: "#c2c6cf", gray: "#8c8f96",
  grey: "#8c8f96", charcoal: "#3c3f45", slate: "#5f6b7a", ash: "#a8a8a4", smoke: "#9a9ca3",
  black: "#1c1d22", ebony: "#22201d", onyx: "#18181b", jet: "#141418",
  rainbow: "rainbow", neon: "neon", pastel: "pastel", gold_: "#e1b83f",
};
// Words that are a colour only when they sit before a noun ("orange cat") and
// a thing otherwise ("an orange").
const COLOR_OR_THING = new Set(["orange", "peach", "lemon", "lime", "cherry", "plum", "rose", "chocolate",
  "coffee", "honey", "sand", "snow", "sky", "grape", "forest", "ash", "smoke", "butter", "wine",
  "jade", "emerald", "ruby", "pearl", "gold", "silver", "bronze", "copper", "rainbow", "caramel", "salmon", "mint"]);

/* ---------------- vocabulary ---------------- */

const LEX = Object.create(null);
function lex(words, entry) {
  for (const raw of words.split(",")) {
    const w = raw.trim();
    if (!w) continue;
    LEX[w] = Object.assign({ key: w }, entry, { label: entry.label || w });
  }
}
const thing = (m, o = {}, extra = {}) => Object.assign({ k: "thing", m, o }, extra);

// --- animals: four legs ---
lex("dog,puppy,pup,doggy,doggo,hound,mutt", thing("quad", { kind: "dog" }, { label: "dog" }));
lex("corgi,poodle,labrador,retriever,golden retriever,husky,beagle,pug,terrier,collie,border collie,dachshund,shiba,chihuahua,bulldog,dalmatian,shepherd,german shepherd,rottweiler,doberman,greyhound,spaniel,schnauzer,pomeranian,samoyed", thing("quad", { kind: "dog" }));
lex("cat,kitten,kitty,kitties,cats,feline,tabby,meow", thing("quad", { kind: "cat" }, { label: "cat" }));
lex("fox,foxes", thing("quad", { kind: "fox" }, { label: "fox" }));
lex("wolf,wolves,coyote", thing("quad", { kind: "wolf" }));
lex("horse,pony,stallion,mare,foal", thing("quad", { kind: "horse" }, { label: "horse" }));
lex("unicorn", thing("quad", { kind: "unicorn" }));
lex("pegasus", thing("quad", { kind: "pegasus" }));
lex("cow,cattle,calf,bull,ox,moo", thing("quad", { kind: "cow" }, { label: "cow" }));
lex("pig,piggy,piglet,hog,boar", thing("quad", { kind: "pig" }, { label: "pig" }));
lex("sheep,lamb,ram", thing("quad", { kind: "sheep" }, { label: "sheep" }));
lex("goat", thing("quad", { kind: "goat" }));
lex("deer,reindeer,moose,elk,fawn,stag,caribou", thing("quad", { kind: "deer" }, { label: "deer" }));
lex("bear,grizzly,teddy,teddy bear", thing("quad", { kind: "bear" }, { label: "bear" }));
lex("polar bear", thing("quad", { kind: "polar" }));
lex("panda", thing("quad", { kind: "panda" }));
lex("koala", thing("quad", { kind: "koala" }));
lex("lion,lioness", thing("quad", { kind: "lion" }, { label: "lion" }));
lex("tiger", thing("quad", { kind: "tiger" }));
lex("cheetah,leopard,jaguar,panther", thing("quad", { kind: "cheetah" }, { label: "big cat" }));
lex("zebra", thing("quad", { kind: "zebra" }));
lex("giraffe", thing("quad", { kind: "giraffe" }));
lex("elephant", thing("quad", { kind: "elephant" }));
lex("rhino,rhinoceros,hippo,hippopotamus", thing("quad", { kind: "hippo" }));
lex("rabbit,bunny,hare,bunnies", thing("quad", { kind: "rabbit" }, { label: "rabbit" }));
lex("mouse,mice,rat,hamster,gerbil,guinea pig", thing("quad", { kind: "mouse" }, { label: "mouse" }));
lex("raccoon,possum,opossum,badger,skunk", thing("quad", { kind: "raccoon" }));
lex("squirrel,chipmunk", thing("quad", { kind: "squirrel" }));
lex("dinosaur,dino,t rex,trex,rex,brontosaurus,brachiosaurus,stegosaurus,raptor,triceratops,godzilla", thing("quad", { kind: "dino" }, { label: "dinosaur" }));
lex("dragon,wyvern", thing("quad", { kind: "dragon" }, { label: "dragon" }));
lex("camel,llama,alpaca", thing("quad", { kind: "camel" }));
lex("monkey,ape,gorilla,chimp,chimpanzee,orangutan,lemur,sloth", thing("quad", { kind: "monkey" }, { label: "monkey" }));
lex("kangaroo", thing("quad", { kind: "rabbit", col: "#b98a5e" }));
lex("animal,animals,pet,pets,creature,beast,critter", thing("quad", { kind: "pet" }, { label: "animal" }));

// --- birds ---
lex("bird,birdie,sparrow,finch,songbird,bluebird,cardinal,canary,robin,jay,blue jay,wren,chickadee,starling,hummingbird", thing("bird", { kind: "bird" }));
lex("crow,raven,blackbird,magpie", thing("bird", { kind: "crow" }, { label: "crow" }));
lex("owl", thing("bird", { kind: "owl" }));
lex("duck,duckling,goose,geese,mallard", thing("bird", { kind: "duck" }, { label: "duck" }));
lex("swan", thing("bird", { kind: "swan" }));
lex("chicken,hen,rooster,chick,turkey", thing("bird", { kind: "chicken" }, { label: "chicken" }));
lex("eagle,hawk,falcon,vulture,condor", thing("bird", { kind: "eagle" }, { label: "eagle" }));
lex("parrot,macaw,parakeet,toucan,cockatoo", thing("bird", { kind: "parrot" }, { label: "parrot" }));
lex("penguin", thing("bird", { kind: "penguin" }));
lex("flamingo", thing("bird", { kind: "flamingo" }));
lex("peacock", thing("bird", { kind: "peacock" }));
lex("seagull,gull,pelican,albatross,pigeon,dove", thing("bird", { kind: "gull" }, { label: "seabird" }));
lex("phoenix,firebird", thing("bird", { kind: "phoenix" }));
lex("bat,bats", thing("bird", { kind: "bat" }, { label: "bat" }));

// --- water ---
lex("fish,goldfish,koi,salmon,trout,tuna,clownfish,nemo,guppy,minnow,carp,bass,fishes", thing("fish", { kind: "fish" }, { label: "fish", hab: "water" }));
lex("whale,orca", thing("fish", { kind: "whale" }, { hab: "water" }));
lex("shark,sharks", thing("fish", { kind: "shark" }, { label: "shark", hab: "water" }));
lex("dolphin,porpoise", thing("fish", { kind: "dolphin" }, { hab: "water" }));
lex("octopus,squid,kraken", thing("fish", { kind: "octopus" }, { label: "octopus", hab: "water" }));
lex("jellyfish,jellies", thing("fish", { kind: "jelly" }, { label: "jellyfish", hab: "water" }));
lex("seahorse", thing("fish", { kind: "fish", col: "#e9a23b" }, { hab: "water" }));
lex("mermaid,merman", thing("person", { kind: "mermaid" }, { hab: "water" }));

// --- small creatures ---
lex("butterfly,butterflies", thing("bug", { kind: "butterfly" }, { label: "butterfly" }));
lex("moth", thing("bug", { kind: "butterfly", col: "#b9a27a" }));
lex("bee,bees,bumblebee,wasp,hornet", thing("bug", { kind: "bee" }, { label: "bee" }));
lex("ladybug,ladybird,beetle", thing("bug", { kind: "ladybug" }, { label: "ladybug" }));
lex("spider,tarantula,web,cobweb,spiderweb", thing("bug", { kind: "spider" }, { label: "spider" }));
lex("ant,ants,bug,bugs,insect,insects,cricket,grasshopper,cockroach,roach", thing("bug", { kind: "ant" }, { label: "bug" }));
lex("dragonfly,firefly,fireflies", thing("bug", { kind: "dragonfly" }, { label: "dragonfly" }));
lex("snail,slug", thing("critter", { kind: "snail" }, { label: "snail" }));
lex("frog,toad,tadpole", thing("critter", { kind: "frog" }, { label: "frog" }));
lex("turtle,tortoise", thing("critter", { kind: "turtle" }, { label: "turtle" }));
lex("crab,lobster,shrimp", thing("critter", { kind: "crab" }, { label: "crab" }));
lex("snake,serpent,python,cobra,worm,eel,caterpillar", thing("critter", { kind: "snake" }, { label: "snake" }));
lex("lizard,gecko,iguana,chameleon,crocodile,alligator,croc,gator", thing("critter", { kind: "lizard" }, { label: "lizard" }));
lex("hedgehog,porcupine", thing("critter", { kind: "hedgehog" }));

// --- people ---
lex("person,people,me,myself,friend,friends,human,someone,somebody,guy,girl,boy,man,woman,men,women,kid,kids,child,children,baby,teen,teenager,student,students,classmate,mom,mother,dad,father,parent,parents,family,brother,sister,sibling,grandma,grandpa,grandmother,grandfather,aunt,uncle,cousin,teacher,professor,coach,boss,player,dancer,singer,artist,athlete,runner,farmer,doctor,nurse,crowd,everyone,we,us,bestie,bff,boyfriend,girlfriend,husband,wife,neighbor,neighbour", thing("person", { kind: "person" }, { label: "person" }));
lex("mr,mrs,ms,dr,sir,madam,mister,miss", thing("person", { kind: "person" }, { label: "person", title: true }));
lex("astronaut,cosmonaut,spaceman", thing("person", { kind: "astronaut" }, { label: "astronaut" }));
lex("wizard,witch,sorcerer,mage,magician,warlock", thing("person", { kind: "wizard" }, { label: "wizard" }));
lex("king,queen,prince,princess,royal,emperor", thing("person", { kind: "royal" }, { label: "royalty" }));
lex("pirate,captain,sailor", thing("person", { kind: "pirate" }, { label: "pirate" }));
lex("knight,soldier,warrior,viking,samurai,ninja", thing("person", { kind: "knight" }, { label: "knight" }));
lex("superhero,hero,superman,batman,spiderman,villain", thing("person", { kind: "hero" }, { label: "superhero" }));
lex("chef,cook,baker", thing("person", { kind: "chef" }, { label: "chef" }));
lex("clown,jester", thing("person", { kind: "clown" }));
lex("robot,robots,android,cyborg,bot,ai", thing("person", { kind: "robot" }, { label: "robot" }));
lex("alien,aliens,martian,extraterrestrial", thing("person", { kind: "alien" }, { label: "alien" }));
lex("ghost,ghosts,spirit,phantom,boo", thing("person", { kind: "ghost" }, { label: "ghost" }));
lex("zombie,zombies,monster,monsters,goblin,troll,ogre,orc", thing("person", { kind: "zombie" }, { label: "monster" }));
lex("vampire,dracula", thing("person", { kind: "vampire" }, { label: "vampire" }));
lex("snowman,snowmen,frosty", thing("person", { kind: "snowman" }, { label: "snowman" }));
lex("fairy,fairies,angel,elf,elves,pixie", thing("person", { kind: "fairy" }, { label: "fairy" }));
lex("santa,santa claus", thing("person", { kind: "santa" }, { label: "santa" }));
lex("cowboy,cowgirl", thing("person", { kind: "cowboy" }, { label: "cowboy" }));

// --- plants ---
lex("tree,trees,oak,maple,elm,birch,willow,woods", thing("tree", { kind: "round" }, { label: "tree" }));
lex("pine,pines,fir,spruce,evergreen,christmas tree,xmas tree", thing("tree", { kind: "pine" }, { label: "pine" }));
lex("palm,palm tree,palms,coconut", thing("tree", { kind: "palm" }, { label: "palm tree" }));
lex("cypress,poplar", thing("tree", { kind: "cypress" }));
lex("blossom,cherry blossom,sakura,orchard", thing("tree", { kind: "blossom" }, { label: "blossom" }));
lex("bush,shrub,hedge", thing("tree", { kind: "bush" }, { label: "bush" }));
lex("cactus,cacti,succulent", thing("tree", { kind: "cactus" }, { label: "cactus" }));
lex("flower,flowers,bloom,blooms,blossoming,petal,petals,bouquet,daisy,daisies,lily,lilies,poppy,poppies,orchid,peony,peonies,lotus,lavender bush,wildflower,wildflowers,iris,dandelion,hibiscus,violets", thing("flower", { kind: "flower" }, { label: "flowers" }));
lex("rose,roses", thing("flower", { kind: "rose" }, { label: "rose" }));
lex("tulip,tulips", thing("flower", { kind: "tulip" }, { label: "tulip" }));
lex("sunflower,sunflowers", thing("flower", { kind: "sunflower" }, { label: "sunflower" }));
lex("mushroom,mushrooms,shroom,toadstool,fungus", thing("flower", { kind: "mushroom" }, { label: "mushroom" }));
lex("grass,plant,plants,leaf,leaves,fern,ivy,vine,weed,clover,shamrock", thing("flower", { kind: "grass" }, { label: "plants" }));

// --- buildings ---
lex("house,houses,home,cottage,cabin,hut,shack,hous", thing("building", { kind: "house" }, { label: "house" }));
lex("barn,farmhouse,shed,stable", thing("building", { kind: "barn" }, { label: "barn" }));
lex("castle,palace,fortress,kingdom,fort", thing("building", { kind: "castle" }, { label: "castle" }));
lex("church,chapel,temple,cathedral,mosque", thing("building", { kind: "church" }, { label: "church" }));
lex("school,college,university,campus,classroom,class,highschool,academy", thing("building", { kind: "school" }, { label: "school" }));
lex("skyscraper,building,buildings,tower,apartment,apartments,office,hotel,hospital,mall,store,shop,cafe,restaurant,bakery,library,museum", thing("building", { kind: "tower" }, { label: "building" }));
lex("lighthouse", thing("building", { kind: "lighthouse" }));
lex("tent,camp,camping,campsite", thing("building", { kind: "tent" }, { label: "tent" }));
lex("igloo", thing("building", { kind: "igloo" }));
lex("pyramid,pyramids", thing("building", { kind: "pyramid" }, { label: "pyramid" }));
lex("windmill", thing("building", { kind: "windmill" }));
lex("bridge", thing("building", { kind: "bridge" }));

// --- vehicles ---
lex("car,cars,auto,automobile,sedan,taxi,cab,jeep,suv,racecar,race car,sportscar,convertible,limo,minivan,vehicle,police car,uber", thing("vehicle", { kind: "car" }, { label: "car" }));
lex("truck,trucks,pickup,lorry,semi,firetruck,fire truck,dump truck,monster truck,van", thing("vehicle", { kind: "truck" }, { label: "truck" }));
lex("bus,school bus,schoolbus", thing("vehicle", { kind: "bus" }, { label: "bus" }));
lex("train,trains,locomotive,subway,metro,tram,railway", thing("vehicle", { kind: "train" }, { label: "train" }));
lex("bike,bicycle,cycling,biking,motorcycle,motorbike,scooter,skateboard", thing("vehicle", { kind: "bike" }, { label: "bike" }));
lex("tractor,bulldozer,excavator", thing("vehicle", { kind: "tractor" }, { label: "tractor" }));
lex("boat,boats,sailboat,sail,yacht,canoe,kayak,raft,rowboat,sailing", thing("boat", { kind: "sail" }, { label: "boat", hab: "water" }));
lex("ship,ships,cruise,ferry,steamboat,titanic", thing("boat", { kind: "ship" }, { label: "ship", hab: "water" }));
lex("pirate ship", thing("boat", { kind: "pirate" }, { hab: "water" }));
lex("submarine,sub", thing("boat", { kind: "sub" }, { label: "submarine", hab: "water" }));
lex("plane,airplane,aeroplane,jet,aircraft,flight,flying,airport", thing("air", { kind: "plane" }, { label: "plane", hab: "sky" }));
lex("helicopter,chopper", thing("air", { kind: "heli" }, { label: "helicopter", hab: "sky" }));
lex("rocket,rockets,spaceship,spacecraft,shuttle,starship,launch", thing("air", { kind: "rocket" }, { label: "rocket", hab: "sky" }));
lex("ufo,ufos,flying saucer,saucer", thing("air", { kind: "ufo" }, { label: "ufo", hab: "sky" }));
lex("hot air balloon,airship,blimp,zeppelin", thing("air", { kind: "hotair" }, { label: "hot air balloon", hab: "sky" }));
lex("balloon,balloons", thing("air", { kind: "balloon" }, { label: "balloons", hab: "sky" }));
lex("kite,kites", thing("air", { kind: "kite" }, { label: "kite", hab: "sky" }));

// --- food ---
lex("pizza,pizzas,pepperoni,slice", thing("food", { kind: "pizza" }, { label: "pizza" }));
lex("cake,cakes,birthday cake,cheesecake,cupcake,cupcakes,muffin", thing("food", { kind: "cake" }, { label: "cake" }));
lex("donut,donuts,doughnut,doughnuts,bagel", thing("food", { kind: "donut" }, { label: "donut" }));
lex("ice cream,icecream,gelato,sundae,popsicle,cone,frozen yogurt", thing("food", { kind: "icecream" }, { label: "ice cream" }));
lex("burger,burgers,hamburger,cheeseburger,sandwich,sub sandwich", thing("food", { kind: "burger" }, { label: "burger" }));
lex("apple,apples,tomato,tomatoes,peach,peaches,plum,plums,fruit,fruits", thing("food", { kind: "apple" }, { label: "apple" }));
lex("orange,oranges,tangerine,clementine,mandarin", thing("food", { kind: "orange" }, { label: "orange" }));
lex("lemon,lemons,lime,limes", thing("food", { kind: "lemon" }, { label: "lemon" }));
lex("banana,bananas", thing("food", { kind: "banana" }, { label: "banana" }));
lex("strawberry,strawberries,raspberry,berries,berry", thing("food", { kind: "strawberry" }, { label: "strawberry" }));
lex("cherry,cherries", thing("food", { kind: "cherry" }, { label: "cherries" }));
lex("watermelon,melon", thing("food", { kind: "watermelon" }, { label: "watermelon" }));
lex("grape,grapes", thing("food", { kind: "grapes" }, { label: "grapes" }));
lex("coffee,latte,espresso,cappuccino,mocha,tea,cocoa,hot chocolate,mug,cup,teacup,boba,drink,soda,juice,milkshake,smoothie", thing("food", { kind: "mug" }, { label: "coffee" }));
lex("cookie,cookies,biscuit,cracker,pancake,pancakes,waffle,waffles", thing("food", { kind: "cookie" }, { label: "cookie" }));
lex("taco,tacos,burrito,quesadilla,nachos", thing("food", { kind: "taco" }, { label: "taco" }));
lex("sushi,ramen,noodles,noodle,spaghetti,pasta,soup,rice,bowl,cereal,salad,curry,pho", thing("food", { kind: "bowl" }, { label: "noodles" }));
lex("fries,french fries,chips,popcorn", thing("food", { kind: "fries" }, { label: "fries" }));
lex("hot dog,hotdog,hotdogs,sausage", thing("food", { kind: "hotdog" }, { label: "hot dog" }));
lex("candy,lollipop,sweets,chocolate,candies,gum", thing("food", { kind: "candy" }, { label: "candy" }));
lex("cheese,cheddar", thing("food", { kind: "cheese" }, { label: "cheese" }));
lex("egg,eggs,breakfast,omelette,bacon", thing("food", { kind: "egg" }, { label: "egg" }));
lex("bread,toast,croissant,loaf,baguette,pie,pretzel", thing("food", { kind: "bread" }, { label: "bread" }));
lex("carrot,carrots,veggie,veggies,vegetable,vegetables,broccoli,corn", thing("food", { kind: "carrot" }, { label: "carrot" }));
lex("pumpkin,pumpkins,jack o lantern,squash", thing("food", { kind: "pumpkin" }, { label: "pumpkin" }));
lex("food,meal,dinner,lunch,snack,snacks,feast,picnic", thing("food", { kind: "feast" }, { label: "food" }));

// --- sky things ---
lex("sun,sunshine,sunny,sunlight", thing("sky", { kind: "sun" }, { label: "sun", hab: "sky" }));
lex("moon,moons,crescent,full moon,moonlight,moonlit,lunar", thing("sky", { kind: "moon" }, { label: "moon", hab: "sky", place: "moon" }));
lex("star,stars,starry,starlight,constellation,constellations,twinkle", thing("sky", { kind: "stars" }, { label: "stars", hab: "sky", time: "night" }));
lex("planet,planets,saturn,jupiter,neptune,uranus,venus,mercury,pluto,solar system", thing("sky", { kind: "planet" }, { label: "planet", hab: "sky" }));
lex("mars", thing("sky", { kind: "mars" }, { hab: "sky", place: "mars" }));
lex("earth,world,globe", thing("sky", { kind: "earth" }, { label: "earth", hab: "sky" }));
lex("comet,meteor,asteroid,shooting star,meteorite", thing("sky", { kind: "comet" }, { label: "comet", hab: "sky" }));
lex("galaxy,galaxies,nebula,milky way,universe,cosmos,black hole", thing("sky", { kind: "galaxy" }, { label: "galaxy", hab: "sky", place: "space" }));
lex("rainbow,rainbows", thing("sky", { kind: "rainbow" }, { label: "rainbow", hab: "sky" }));
lex("cloud,clouds,cloudy,overcast", thing("sky", { kind: "cloud" }, { label: "clouds", hab: "sky" }));

// --- objects ---
lex("heart,hearts,valentine,valentines", thing("obj", { kind: "heart" }, { label: "heart" }));
lex("book,books,novel,reading,notebook,textbook,homework,essay,study,studying,notes,diary,journal,library card", thing("obj", { kind: "books" }, { label: "books" }));
lex("exam,exams,test,tests,quiz,quizzes,midterm,midterms,final,finals,grade,grades,paper,papers,assignment,worksheet,report card", thing("obj", { kind: "paper" }, { label: "exam" }));
lex("clock,clocks,time,watch,alarm,deadline,deadlines,hour,hours,minute,late", thing("obj", { kind: "clock" }, { label: "clock" }));
lex("phone,phones,iphone,smartphone,cellphone,texting,tiktok,instagram,snapchat,social media", thing("obj", { kind: "phone" }, { label: "phone" }));
lex("computer,laptop,pc,mac,screen,monitor,code,coding,programming,keyboard,internet,email", thing("obj", { kind: "laptop" }, { label: "laptop" }));
lex("music,song,songs,melody,note,concert,band,rap,jazz,singing,sing,dance,dancing,party music,headphones,playlist", thing("obj", { kind: "notes" }, { label: "music" }));
lex("guitar,violin,ukulele,bass guitar,cello", thing("obj", { kind: "guitar" }, { label: "guitar" }));
lex("piano,drum,drums,trumpet,saxophone,flute", thing("obj", { kind: "notes" }, { label: "music" }));
lex("ball,balls,soccer,football,basketball,baseball,volleyball,tennis,sports,sport,game,games,goal,kickball,dodgeball,softball,bowling,golf", thing("obj", { kind: "ball" }, { label: "ball" }));
lex("crown,tiara", thing("obj", { kind: "crown" }, { label: "crown" }));
lex("key,keys,lock", thing("obj", { kind: "key" }, { label: "key" }));
lex("umbrella,umbrellas,parasol", thing("obj", { kind: "umbrella" }, { label: "umbrella" }));
lex("candle,candles,candlelight,lantern,lanterns,lamp,lamps,lightbulb,light,lights,torch", thing("obj", { kind: "candle" }, { label: "light" }));
lex("gift,gifts,present,presents,package,box,boxes", thing("obj", { kind: "gift" }, { label: "gift" }));
lex("trophy,trophies,medal,award,prize,win,winner,winning,champion,championship", thing("obj", { kind: "trophy" }, { label: "trophy" }));
lex("pencil,pencils,pen,pens,crayon,crayons,brush,paintbrush,marker", thing("obj", { kind: "pencil" }, { label: "pencil" }));
lex("sword,swords,dagger,blade,axe,shield", thing("obj", { kind: "sword" }, { label: "sword" }));
lex("flag,flags,banner", thing("obj", { kind: "flag" }, { label: "flag" }));
lex("diamond,diamonds,gem,gems,jewel,jewels,crystal,crystals,treasure,ring,rings", thing("obj", { kind: "gem" }, { label: "gem" }));
lex("money,cash,coin,coins,dollar,dollars,rich,gold coin,bank,paycheck,salary", thing("obj", { kind: "coins" }, { label: "money" }));
lex("camera,photo,photos,picture,selfie", thing("obj", { kind: "camera" }, { label: "camera" }));
lex("controller,videogame,video game,videogames,video games,gaming,gamer,xbox,playstation,nintendo,minecraft,fortnite,roblox,console", thing("obj", { kind: "controller" }, { label: "video game" }));
lex("dice,die,board game,chess", thing("obj", { kind: "dice" }, { label: "dice" }));
lex("letter,letters,envelope,mail,postcard,message", thing("obj", { kind: "letter" }, { label: "letter" }));
lex("fire,fires,flame,flames,campfire,bonfire,burning,lit,blaze", thing("obj", { kind: "fire" }, { label: "fire" }));
lex("skull,skulls,skeleton,bones,bone,death,dead", thing("obj", { kind: "skull" }, { label: "skull" }));
lex("rock,rocks,stone,stones,boulder,pebble,pebbles", thing("obj", { kind: "rock" }, { label: "rock" }));
lex("shell,shells,seashell,seashells", thing("obj", { kind: "shell" }, { label: "seashell" }));
lex("feather,feathers", thing("obj", { kind: "feather" }, { label: "feather" }));
lex("snowflake,snowflakes", thing("obj", { kind: "snowflake" }, { label: "snowflake" }));
lex("anchor", thing("obj", { kind: "anchor" }));
lex("bed,bedroom,pillow,blanket,couch,sofa,nap,naps", thing("obj", { kind: "bed" }, { label: "bed" }));
lex("chair,chairs,desk,desks,table", thing("obj", { kind: "chair" }, { label: "chair" }));
lex("hat,hats,cap,beanie", thing("obj", { kind: "hat" }, { label: "hat" }));
lex("shoe,shoes,sneaker,sneakers,boot,boots", thing("obj", { kind: "shoe" }, { label: "shoe" }));
lex("glasses,sunglasses", thing("obj", { kind: "glasses" }, { label: "glasses" }));
lex("eye,eyes", thing("obj", { kind: "eye" }, { label: "eye" }));
lex("brain,brains,mind,idea,ideas,thinking,think,smart", thing("obj", { kind: "bulb" }, { label: "idea" }));
lex("bell,bells", thing("obj", { kind: "bell" }, { label: "bell" }));
lex("bomb,explosion,boom,kaboom,firework,fireworks,sparkler", thing("obj", { kind: "firework" }, { label: "fireworks" }));
lex("confetti,celebration,celebrate,party,parties,fiesta,festival,birthday,bday,graduation,prom,wedding", thing("obj", { kind: "confetti" }, { label: "party" }));
lex("star shape", thing("obj", { kind: "star" }));

// --- places ---
const place = (p, extra = {}) => Object.assign({ k: "place", p }, extra);
lex("space,outer space,outerspace,orbit,cosmic,interstellar,zero gravity", place("space"));
lex("beach,beaches,shore,seaside,coast,sand,sandy,surf,surfing,tropical,tropics,vacation", place("beach", { label: "beach" }));
lex("ocean,oceans,sea,seas,waves,wave,water,bay,harbor,harbour,lagoon,pacific,atlantic", place("ocean", { label: "ocean" }));
lex("underwater,undersea,reef,coral reef,deep sea,seabed,aquarium,under the sea,scuba,diving", place("underwater", { label: "underwater" }));
lex("lake,lakes,pond,river,rivers,stream,creek,canal,fishing", place("lake", { label: "lake" }));
lex("island,islands", place("island"));
lex("forest,forests,jungle,rainforest,woodland,grove,wilderness", place("forest", { label: "forest" }));
lex("mountain,mountains,mountainside,peak,peaks,alps,rockies,hiking,hike,cliff,cliffs,summit,canyon,valley", place("mountains", { label: "mountains" }));
lex("volcano,volcanoes,lava,magma,eruption,erupting,erupt", place("volcano", { label: "volcano" }));
lex("hill,hills,hillside,countryside,meadow,meadows,field,fields,prairie,plains,grassland,pasture,park,garden,gardens,backyard,yard,lawn", place("meadow", { label: "meadow" }));
lex("farm,farms,ranch,farmland", place("farm", { label: "farm" }));
lex("desert,deserts,dunes,dune,sahara,arizona,egypt", place("desert", { label: "desert" }));
lex("city,cities,downtown,town,street,streets,skyline,new york,nyc,tokyo,paris,london,chicago,los angeles,urban,neighborhood,road,highway,traffic", place("city", { label: "city" }));
lex("arctic,antarctica,north pole,south pole,tundra,glacier,iceberg,icy,ice", place("arctic", { label: "arctic" }));
lex("room,indoors,inside,kitchen,living room,dorm,dorms,apartment room,cafeteria,hallway,office room,studio", place("room", { label: "indoors" }));
lex("stadium,arena,court,pitch,playground", place("stadium", { label: "stadium" }));
lex("sky,skies,air,heaven,heavens,clouds above", place("skyonly", { label: "sky" }));
lex("cave,caves,cavern,underground,dungeon,mine", place("cave", { label: "cave" }));
lex("swamp,marsh,bayou,bog", place("swamp", { label: "swamp" }));

// --- time of day ---
const time = (t, extra = {}) => Object.assign({ k: "time", t }, extra);
lex("morning,dawn,sunrise,daybreak,early", time("dawn", { label: "dawn" }));
lex("day,daytime,noon,afternoon,midday,today", time("day", { label: "day" }));
lex("evening,sunset,dusk,twilight,golden hour,sundown", time("sunset", { label: "sunset" }));
lex("night,nights,nighttime,midnight,dark,darkness,tonight,nocturnal,late night,overnight,3am,2am,1am", time("night", { label: "night" }));

// --- weather ---
const wx = (w, extra = {}) => Object.assign({ k: "weather", w }, extra);
lex("rain,rainy,raining,rainstorm,drizzle,shower,showers,downpour,wet,puddle,puddles", wx("rain", { label: "rain" }));
lex("storm,stormy,thunder,thunderstorm,lightning,hurricane,tornado,typhoon", wx("storm", { label: "storm" }));
lex("snow,snowy,snowing,snowfall,blizzard,snowstorm,flurries,frost,frosty", wx("snow", { label: "snow" }));
lex("fog,foggy,mist,misty,haze,hazy", wx("fog", { label: "fog" }));
lex("wind,windy,breeze,breezy,gust", wx("wind", { label: "wind" }));

// --- seasons / holidays (expand to scene ideas) ---
const season = (s, extra = {}) => Object.assign({ k: "season", s }, extra);
lex("spring,springtime,april,may,easter", season("spring", { label: "spring" }));
lex("summer,summertime,june,july,august,hot,heat,heatwave,warm", season("summer", { label: "summer" }));
lex("fall,autumn,september,october,november,thanksgiving,harvest", season("autumn", { label: "autumn" }));
lex("winter,wintertime,december,january,february,cold,freezing,chilly,frozen", season("winter", { label: "winter" }));
lex("halloween,spooky season,trick or treat", season("halloween", { label: "halloween" }));
lex("christmas,xmas,holiday,holidays,new year,new years", season("christmas", { label: "christmas" }));

// --- moods ---
const mood = (md, extra = {}) => Object.assign({ k: "mood", md }, extra);
lex("happy,happiness,joy,joyful,glad,cheerful,fun,funny,good,great,awesome,amazing,yay,smile,smiling,laugh,laughing,lol,lmao,haha,best,cute,silly,friendly,bright,sunny day,wholesome,nice,cool", mood("happy", { label: "happy" }));
lex("sad,sadness,unhappy,lonely,alone,cry,crying,tears,depressed,blue mood,gloomy,miss,missing,heartbreak,heartbroken,grief,melancholy,tired,exhausted,bored,boring,meh,monday,mondays", mood("sad", { label: "sad" }));
lex("angry,anger,mad,rage,furious,hate,annoyed,frustrated,frustration,grr,ugh", mood("angry", { label: "angry" }));
lex("calm,peace,peaceful,quiet,chill,chilling,relax,relaxing,relaxed,serene,tranquil,zen,gentle,soft,slow,lazy,sleep,sleeping,sleepy,asleep,dream,dreams,dreaming,dreamy,meditate,cozy,comfy,weekend,saturday,sunday,break,recess", mood("calm", { label: "calm" }));
lex("scary,scared,fear,afraid,spooky,creepy,haunted,horror,nightmare,terrifying,evil,dark mood,eerie,ominous,mysterious,mystery", mood("spooky", { label: "spooky" }));
lex("love,loving,romance,romantic,crush,kiss,date,adore,sweet,sweetheart,hug,hugs,xoxo", mood("love", { label: "love" }));
lex("stress,stressed,stressful,anxious,anxiety,panic,chaos,chaotic,busy,overwhelmed,cram,cramming,rush,hurry,crazy,hectic,pressure,worried,worry,nervous", mood("stressed", { label: "stressed" }));
lex("excited,exciting,hype,hyped,energy,energetic,wild,epic,loud,fast,speed,racing,race,victory,yes,wow,omg,lit up", mood("excited", { label: "excited" }));
lex("magic,magical,enchanted,fantasy,fairy tale,fairytale,mystical,wonder,wonderful,sparkle,sparkly,glitter,shiny,glowing,glow,dreamland,whimsical", mood("magic", { label: "magic" }));
lex("hungry,hunger,starving,yummy,delicious,tasty", mood("hungry", { label: "hungry" }));

// --- size / count / actions ---
lex("big,huge,giant,gigantic,enormous,massive,large,tall,mega,jumbo,fat,chonky,chunky,thicc", { k: "size", v: 1.35 });
lex("small,tiny,little,mini,baby sized,teeny,itty,wee,smol,short", { k: "size", v: 0.72 });
const NUMBER_WORDS = { two: 2, pair: 2, couple: 2, both: 2, three: 3, few: 3, four: 4, five: 5, six: 5, seven: 5, eight: 5, nine: 5, ten: 5, many: 5, lots: 5, several: 4, bunch: 4, herd: 4, flock: 5, pack: 4, school: 0, swarm: 6, army: 6, hundred: 7, hundreds: 7, thousand: 7, million: 7, infinite: 7, some: 3, all: 4 };
const act = (a, extra = {}) => Object.assign({ k: "act", a }, extra);
lex("eating,eats,eat,ate,munching,chewing,biting,nibbling,devouring,feeding,tasting,licking", act("eat", { label: "eating" }));
lex("holding,holds,hold,carrying,carries,with,has,having,hugging,grabbing,playing with", act("hold", { label: "holding" }));
lex("flying,flies,fly,soaring,floating,float,hovering,gliding,levitating,jumping,jump,leaping,falling", act("fly", { label: "flying" }));
lex("swimming,swims,swim,diving,surfing,paddling", act("swim", { label: "swimming" }));
lex("running,runs,run,racing,chasing,zooming,sprinting,skating,skiing,escaping,rushing", act("run", { label: "running" }));
lex("driving,drives,drive,drove,riding,rides,ride,rode,piloting,steering,sailing in", act("ride", { label: "riding" }));
lex("sleeping,sleeps,napping,dozing,resting,snoring,dreaming of", act("sleep", { label: "sleeping" }));
lex("dancing,dances,singing,sings,partying,celebrating,playing music,vibing", act("dance", { label: "dancing" }));
lex("reading,studying,writing,doing homework,learning,working", act("study", { label: "studying" }));
lex("crying,weeping,sobbing", act("cry", { label: "crying" }));

// Words that mean a bundle of things: "finals week" isn't one object.
const EXPAND = {
  "finals week": { things: ["books", "clock", "coffee"], mood: "stressed", time: "night", label: "finals week" },
  "final exam": { things: ["exam", "clock"], mood: "stressed", label: "final exam" },
  "exam week": { things: ["exam", "books", "clock"], mood: "stressed", label: "exam week" },
  "all nighter": { things: ["laptop", "coffee", "clock"], mood: "stressed", time: "night", label: "all-nighter" },
  "allnighter": { things: ["laptop", "coffee", "clock"], mood: "stressed", time: "night", label: "all-nighter" },
  "first day of school": { things: ["school", "bus", "person"], mood: "excited", time: "dawn", label: "first day of school" },
  "summer break": { things: ["sun", "ice cream"], place: "beach", mood: "happy", label: "summer break" },
  "spring break": { things: ["palm", "sun"], place: "beach", mood: "excited", label: "spring break" },
  "game day": { things: ["ball", "flag"], place: "stadium", mood: "excited", label: "game day" },
  "road trip": { things: ["car"], place: "desert", mood: "happy", label: "road trip" },
  "snow day": { things: ["snowman", "person"], weather: "snow", mood: "happy", label: "snow day" },
  "movie night": { things: ["popcorn", "screen"], time: "night", place: "room", label: "movie night" },
  "sleepover": { things: ["bed", "person", "person"], time: "night", place: "room", mood: "happy", label: "sleepover" },
  "monday morning": { things: ["coffee", "clock"], mood: "sad", time: "dawn", label: "monday morning" },
  "bad day": { things: ["cloud"], weather: "rain", mood: "sad", label: "bad day" },
  "good day": { things: ["sun", "flower"], mood: "happy", label: "good day" },
  "birthday party": { things: ["cake", "balloons", "gift"], mood: "excited", label: "birthday party" },
  "lunch break": { things: ["burger", "fries"], mood: "happy", label: "lunch break" },
  "the end": { things: ["sun"], time: "sunset", mood: "calm", label: "the end" },
  "homework": { things: ["books", "pencil"], mood: "stressed", label: "homework" },
  "graduation": { things: ["person", "confetti", "hat"], mood: "excited", label: "graduation" },
  "christmas": { things: ["christmas tree", "gift"], weather: "snow", label: "christmas" },
  "halloween": { things: ["pumpkin", "ghost"], time: "night", mood: "spooky", label: "halloween" },
  "thanksgiving": { things: ["turkey", "pie"], season: "autumn", label: "thanksgiving" },
  "valentines day": { things: ["heart", "rose"], mood: "love", label: "valentine's day" },
  "global warming": { things: ["earth", "fire"], season: "summer", mood: "stressed", label: "global warming" },
  "climate change": { things: ["earth", "fire"], season: "summer", mood: "stressed", label: "climate change" },
  "the future": { things: ["robot", "rocket"], place: "city", mood: "magic", label: "the future" },
  "outer space": { place: "space", label: "outer space" },
  "under the sea": { place: "underwater", label: "under the sea" },
  "deep sea": { place: "underwater", label: "deep sea" },
  "north pole": { place: "arctic", label: "north pole" },
};
const EXPAND_SINGLE = { finals: "finals week", homework: "homework", graduation: "graduation", christmas: "christmas", halloween: "halloween", thanksgiving: "thanksgiving", allnighter: "allnighter", sleepover: "sleepover" };

const STOP = new Set(("a,an,the,my,our,your,his,her,its,their,of,in,on,at,to,for,from,by,into,onto,upon,over,under," +
  "and,or,but,is,are,was,were,be,been,being,am,it,this,that,these,those,there,here,i,you,he,she,they,them,him," +
  "very,so,too,just,really,quite,some,any,as,than,then,like,about,around,near,next,beside,behind,between,above,below," +
  "inside,outside,through,across,during,while,who,what,when,where,why,how,which,not,no,do,does,did,doing,done," +
  "can,could,would,should,will,shall,may,might,must,get,got,gets,make,made,let,lets,go,going,goes,went,gone," +
  "watercolor,watercolour,watercolors,painting,paint,painted,draw,drawing,drawn,picture,image,art,artwork,sketch," +
  "style,scene,illustration,please,pls,plz,thing,things,stuff,kind,sort,one,ones,out,up,down,off,again,ever,never," +
  "also,only,even,still,yet,until,im,ive,id,dont,cant,wont,isnt,its,thats,whats,us,me too,own,each,every,much,more,most," +
  "other,another,same,new,old,way,ok,okay,yeah,hey,hi,hello,s,t,de,la,le,el,y,o,u,ur,rn,w").split(","));
const PREP_PLACE = new Set(["on", "in", "at", "inside", "into", "onto", "across", "through", "to", "from", "under", "beneath", "near", "by", "over", "above", "around", "within", "visiting", "toward", "towards"]);

// Emoji → word. Unknown emoji become hashed glyphs.
const EMOJI = {
  "🐶": "dog", "🐕": "dog", "🦮": "dog", "🐩": "poodle", "🐱": "cat", "🐈": "cat", "🦊": "fox", "🐺": "wolf",
  "🐴": "horse", "🐎": "horse", "🦄": "unicorn", "🐮": "cow", "🐄": "cow", "🐷": "pig", "🐖": "pig", "🐑": "sheep",
  "🐐": "goat", "🦌": "deer", "🐻": "bear", "🐻‍❄️": "polar bear", "🐼": "panda", "🐨": "koala", "🦁": "lion",
  "🐯": "tiger", "🐅": "tiger", "🐆": "leopard", "🦓": "zebra", "🦒": "giraffe", "🐘": "elephant", "🦏": "rhino",
  "🦛": "hippo", "🐰": "rabbit", "🐇": "rabbit", "🐭": "mouse", "🐁": "mouse", "🐀": "rat", "🐹": "hamster",
  "🦝": "raccoon", "🐿️": "squirrel", "🐿": "squirrel", "🦖": "dinosaur", "🦕": "dinosaur", "🐉": "dragon",
  "🐲": "dragon", "🐪": "camel", "🐫": "camel", "🦙": "llama", "🐵": "monkey", "🐒": "monkey", "🦍": "gorilla",
  "🦘": "kangaroo", "🐦": "bird", "🐤": "chick", "🐥": "chick", "🐣": "chick", "🦉": "owl", "🦆": "duck",
  "🦢": "swan", "🐔": "chicken", "🐓": "rooster", "🦃": "turkey", "🦅": "eagle", "🦜": "parrot", "🐧": "penguin",
  "🦩": "flamingo", "🦚": "peacock", "🕊️": "dove", "🕊": "dove", "🦇": "bat", "🐟": "fish", "🐠": "fish",
  "🐡": "fish", "🐳": "whale", "🐋": "whale", "🦈": "shark", "🐬": "dolphin", "🐙": "octopus", "🦑": "squid",
  "🪼": "jellyfish", "🦋": "butterfly", "🐝": "bee", "🐞": "ladybug", "🕷️": "spider", "🕷": "spider", "🐜": "ant",
  "🐛": "caterpillar", "🐌": "snail", "🐸": "frog", "🐢": "turtle", "🦀": "crab", "🦞": "lobster", "🐍": "snake",
  "🦎": "lizard", "🐊": "crocodile", "🦔": "hedgehog", "🧜": "mermaid", "🧜‍♀️": "mermaid",
  "🧑": "person", "👩": "person", "👨": "person", "👧": "girl", "👦": "boy", "👶": "baby", "🧒": "kid",
  "🧑‍🚀": "astronaut", "👩‍🚀": "astronaut", "👨‍🚀": "astronaut", "🧙": "wizard", "🧙‍♂️": "wizard", "🧙‍♀️": "witch",
  "👑": "crown", "🤴": "prince", "👸": "princess", "🏴‍☠️": "pirate", "🦸": "superhero", "🤖": "robot", "👽": "alien",
  "👾": "alien", "👻": "ghost", "🧟": "zombie", "👹": "monster", "🧛": "vampire", "⛄": "snowman", "☃️": "snowman",
  "🧚": "fairy", "👼": "angel", "🎅": "santa", "🤠": "cowboy", "🧑‍🍳": "chef", "🤡": "clown",
  "🌳": "tree", "🌲": "pine", "🌴": "palm", "🎄": "christmas tree", "🌸": "cherry blossom", "🌺": "hibiscus",
  "🌻": "sunflower", "🌷": "tulip", "🌹": "rose", "🥀": "rose", "💐": "bouquet", "🌼": "daisy", "🌵": "cactus",
  "🍄": "mushroom", "🌿": "leaf", "🍀": "clover", "🍁": "autumn", "🍂": "autumn", "🌱": "plant",
  "🏠": "house", "🏡": "house", "🏰": "castle", "🏯": "castle", "⛪": "church", "🏫": "school", "🏢": "building",
  "🏙️": "city", "🏙": "city", "🌆": "city", "🌃": "city", "🗼": "tower", "⛺": "tent", "🛖": "hut", "🏛️": "museum",
  "🚗": "car", "🚙": "car", "🏎️": "racecar", "🏎": "racecar", "🚕": "taxi", "🚓": "police car", "🚚": "truck",
  "🛻": "truck", "🚒": "fire truck", "🚌": "bus", "🚂": "train", "🚆": "train", "🚇": "subway", "🚲": "bike",
  "🏍️": "motorcycle", "🛵": "scooter", "🚜": "tractor", "⛵": "sailboat", "🚤": "boat", "🛶": "canoe", "🚢": "ship",
  "✈️": "plane", "✈": "plane", "🛩️": "plane", "🚁": "helicopter", "🚀": "rocket", "🛸": "ufo", "🎈": "balloon",
  "🪁": "kite", "🍕": "pizza", "🎂": "birthday cake", "🍰": "cake", "🧁": "cupcake", "🍩": "donut", "🍦": "ice cream",
  "🍨": "ice cream", "🍧": "ice cream", "🍔": "burger", "🥪": "sandwich", "🍎": "apple", "🍏": "apple",
  "🍊": "orange", "🍋": "lemon", "🍌": "banana", "🍓": "strawberry", "🍒": "cherries", "🍉": "watermelon",
  "🍇": "grapes", "🍑": "peach", "🍅": "tomato", "☕": "coffee", "🍵": "tea", "🧋": "boba", "🥤": "soda",
  "🍪": "cookie", "🥞": "pancakes", "🌮": "taco", "🌯": "burrito", "🍣": "sushi", "🍜": "ramen", "🍝": "spaghetti",
  "🍟": "fries", "🍿": "popcorn", "🌭": "hot dog", "🍭": "lollipop", "🍬": "candy", "🍫": "chocolate",
  "🧀": "cheese", "🍳": "egg", "🥚": "egg", "🍞": "bread", "🥐": "croissant", "🥕": "carrot", "🎃": "halloween",
  "🥧": "pie", "🍱": "food",
  "☀️": "sun", "☀": "sun", "🌞": "sun", "🌝": "full moon", "🌙": "moon", "🌛": "moon", "🌜": "moon", "🌕": "full moon",
  "🌑": "moon", "⭐": "star", "🌟": "star", "✨": "sparkle", "💫": "star", "🌠": "shooting star", "🪐": "planet",
  "🌍": "earth", "🌎": "earth", "🌏": "earth", "☄️": "comet", "🌌": "galaxy", "🌈": "rainbow", "☁️": "cloud",
  "☁": "cloud", "⛅": "cloudy", "🌤️": "sunny", "🌧️": "rain", "🌧": "rain", "☔": "rain", "⛈️": "storm",
  "⛈": "storm", "🌩️": "lightning", "⚡": "lightning", "🌪️": "tornado", "❄️": "snowflake", "❄": "snowflake",
  "🌨️": "snow", "🌫️": "fog", "🌬️": "wind", "💨": "wind", "🔥": "fire", "💧": "rain", "🌊": "ocean",
  "🏔️": "mountain", "⛰️": "mountain", "🌋": "volcano", "🏝️": "island", "🏖️": "beach", "🏜️": "desert",
  "🌅": "sunrise", "🌄": "sunrise", "🌇": "sunset", "🌉": "bridge", "🏟️": "stadium", "🏞️": "park",
  "❤️": "heart", "❤": "heart", "🧡": "heart", "💛": "heart", "💚": "heart", "💙": "heart", "💜": "heart",
  "🖤": "heart", "🤍": "heart", "💖": "heart", "💕": "love", "💗": "heart", "💘": "heart", "💝": "heart",
  "💔": "heartbreak", "😍": "love", "🥰": "love", "😘": "love",
  "😀": "happy", "😃": "happy", "😄": "happy", "😁": "happy", "😊": "happy", "🙂": "happy", "😆": "happy",
  "😂": "laughing", "🤣": "laughing", "😎": "cool", "🥳": "party", "🎉": "party", "🎊": "confetti",
  "😢": "sad", "😭": "crying", "☹️": "sad", "🙁": "sad", "😞": "sad", "😔": "sad", "😩": "tired", "😫": "tired",
  "🥱": "tired", "😴": "sleepy", "💤": "sleep", "😡": "angry", "🤬": "angry", "😠": "angry", "😤": "angry",
  "😱": "scared", "😨": "scared", "😰": "anxious", "😬": "nervous", "🤯": "stressed", "💀": "skull",
  "☠️": "skull", "🤔": "thinking", "🧠": "brain", "💡": "idea", "😋": "yummy", "🤤": "hungry", "🤩": "excited",
  "📚": "books", "📖": "book", "📝": "homework", "✏️": "pencil", "🖊️": "pen", "⏰": "clock", "⌚": "watch",
  "🕐": "clock", "⌛": "clock", "⏳": "clock", "📱": "phone", "💻": "laptop", "🖥️": "computer", "⌨️": "keyboard",
  "🎵": "music", "🎶": "music", "🎸": "guitar", "🎹": "piano", "🥁": "drum", "🎤": "singing", "🎧": "headphones",
  "⚽": "soccer", "🏀": "basketball", "🏈": "football", "⚾": "baseball", "🎾": "tennis", "🏐": "volleyball",
  "🎮": "video game", "🕹️": "video game", "🎲": "dice", "♟️": "chess", "🎁": "gift", "🏆": "trophy",
  "🥇": "medal", "🔑": "key", "🗝️": "key", "☂️": "umbrella", "🌂": "umbrella", "🕯️": "candle", "💎": "diamond",
  "💍": "ring", "💰": "money", "💵": "money", "🪙": "coin", "📷": "camera", "📸": "camera", "✉️": "letter",
  "💌": "letter", "⚔️": "sword", "🗡️": "sword", "🛡️": "shield", "🚩": "flag", "🏁": "flag", "🔔": "bell",
  "🎆": "fireworks", "🎇": "fireworks", "💣": "bomb", "💥": "explosion", "🪨": "rock", "🐚": "shell",
  "⚓": "anchor", "🛏️": "bed", "🪑": "chair", "🎩": "hat", "👟": "shoe", "👓": "glasses", "🕶️": "sunglasses",
  "👀": "eyes", "👁️": "eye", "🦴": "bone",
};

/* ---------------- tokenizer + stemmer ---------------- */

const EMOJI_RE = /(\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*)/gu;

function tokenize(text) {
  const out = [];
  // Keep emoji in order with the words around them.
  const pieces = text.split(EMOJI_RE).filter((p) => p !== undefined && p !== "" && p !== "️");
  for (const piece of pieces) {
    if (/\p{Extended_Pictographic}/u.test(piece)) {
      const clean = piece.replace(/\p{Emoji_Modifier}/gu, "");
      out.push({ emoji: clean, raw: piece });
      continue;
    }
    const norm = piece
      .replace(/[’`]/g, "'")
      .replace(/:\)|:-\)|:D|\(:/g, " smile ")
      .replace(/:\(|:-\(|\):/g, " sad ")
      .replace(/<3/g, " heart ")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "");
    const words = norm.match(/[\p{L}\p{N}]+(?:'[\p{L}]+)?/gu) || [];
    for (let w of words) {
      const raw = w;
      w = w.toLowerCase().replace(/'s$/, "").replace(/'/g, "");
      if (w) out.push({ w, raw });
    }
  }
  return out;
}

function stemCandidates(w) {
  const c = [w];
  if (w.length > 3) {
    if (w.endsWith("ies")) c.push(w.slice(0, -3) + "y");
    if (w.endsWith("ves")) c.push(w.slice(0, -3) + "f", w.slice(0, -3) + "fe");
    if (w.endsWith("es")) c.push(w.slice(0, -2));
    if (w.endsWith("s") && !w.endsWith("ss")) c.push(w.slice(0, -1));
    if (w.endsWith("ing")) {
      const b = w.slice(0, -3);
      c.push(b, b + "e");
      if (b.length > 2 && b[b.length - 1] === b[b.length - 2]) c.push(b.slice(0, -1));
    }
    if (w.endsWith("ed")) {
      const b = w.slice(0, -2);
      c.push(b, b + "e", w.slice(0, -1));
      if (b.length > 2 && b[b.length - 1] === b[b.length - 2]) c.push(b.slice(0, -1));
    }
    if (w.endsWith("y") && w.length > 4) c.push(w.slice(0, -1));
    if (w.endsWith("er") && w.length > 5) c.push(w.slice(0, -2));
    if (w.endsWith("est") && w.length > 5) c.push(w.slice(0, -3));
    if (w.endsWith("ish") && w.length > 5) c.push(w.slice(0, -3));
    if (w.endsWith("ly") && w.length > 5) c.push(w.slice(0, -2));
  }
  // Squeezed letters ("soooo", "yayyy", "happyyyy").
  const squeezed = w.replace(/(.)\1{2,}/g, "$1");
  if (squeezed !== w) c.push(squeezed, squeezed.replace(/(.)\1+/g, "$1"));
  return c;
}

function lookupWord(w) {
  for (const cand of stemCandidates(w)) {
    if (LEX[cand]) return { entry: LEX[cand], via: cand };
    if (NAMED_COLORS[cand] && NAMED_COLORS[cand] !== undefined) return { color: cand };
  }
  return null;
}

// A few hundred common first names so "maya and her cat" paints a person.
const NAMES = new Set(("aaliyah,abby,adam,adrian,aiden,alex,alexa,alice,amelia,amir,amy,ana,andrew,angel,anna,anthony,aria,ariana," +
  "ava,ben,bella,brandon,brian,brooklyn,caleb,cameron,carlos,charlie,chloe,chris,claire,daniel,david,diego,dylan,eli," +
  "elijah,ella,ellie,emily,emma,eric,ethan,eva,evan,ezra,gabriel,grace,hannah,harper,henry,isaac,isabella,isaiah,jack," +
  "jackson,jacob,jake,james,jasmine,jason,jayden,jordan,jose,joseph,josh,joshua,julia,julian,justin,kai,kayla,kevin," +
  "kim,kyle,layla,leah,leo,liam,lily,logan,lucas,lucy,luis,luke,luna,madison,maria,mason,mateo,maya,mia,michael," +
  "mila,miles,nathan,noah,nora,nova,olivia,omar,owen,riley,ryan,sam,samuel,sara,sarah,scarlett,sebastian,sofia," +
  "sophia,sophie,stella,taylor,theo,tyler,victoria,violet,william,wyatt,zoe,zoey,jamal,aisha,fatima,mohammed,muhammad," +
  "priya,raj,wei,yuki,hana,kenji,jin,min,ali,sofia,lucia,mateo,santiago,valentina,camila,diana,elena,ivan,olga," +
  "nina,max,jesse,casey,morgan,jamie,quinn,avery,parker,rowan,sage,blake,cole,hunter,grant,tom,tim,joe,bob,bill," +
  "sue,ann,jen,jenny,kate,katie,meg,beth,liz,steve,mike,matt,nick,dan,dave,pat,ray,kayden,brayden,nevaeh,aubrey,addison").split(","));

/* ---------------- parse ---------------- */

function parsePrompt(text) {
  const prompt = (text || "").trim();
  const toks = tokenize(prompt);
  const items = [];
  const seen = [];
  const unknown = [];
  const pendingColors = [];
  let pendingSize = 1;
  let pendingCount = 0;
  let lastThing = null;
  let pendingAct = null;
  let andBefore = false;
  const tints = [];
  const plan = {
    prompt, things: [], place: null, time: null, weather: [], season: null, moods: [], tints, unknown, seen,
    hash: strHash(prompt.toLowerCase()), acts: [],
  };
  const addSeen = (label, kind) => {
    if (!seen.some((s) => s.label === label && s.kind === kind)) seen.push({ label, kind });
  };

  const addThing = (entry, label, opts = {}) => {
    // "cup of coffee", "slice of pizza": same motif twice in a row is one thing
    if (lastThing && lastThing.label === label && lastThing.m === entry.m && plan.things[plan.things.length - 1] === lastThing && !pendingCount && !opts.name) {
      if (opts.and) lastThing.count = Math.min(7, lastThing.count + 1);
      else if (opts.plural && lastThing.count === 1) lastThing.count = 2;
      return lastThing;
    }
    const t = {
      m: entry.m, o: Object.assign({}, entry.o), label, hab: entry.hab || null,
      color: null, count: 1, scale: 1, act: null, held: null, raw: label,
    };
    if (pendingColors.length) {
      t.color = pendingColors.splice(0).pop();
    }
    if (opts.plural) t.count = 2 + (strHash(label + prompt) % 2);
    if (pendingCount) {
      t.count = pendingCount;
      pendingCount = 0;
    }
    t.scale = pendingSize;
    pendingSize = 1;
    if (pendingAct && pendingAct.a === "ride" && lastThing && lastThing !== t) {
      t.rider = lastThing;
      lastThing.ridingOn = t;
      lastThing.act = lastThing.act || "ride";
      pendingAct = null;
    }
    if (pendingAct && lastThing && pendingAct.a !== "ride" && pendingAct.a !== "fly" && pendingAct.a !== "swim" && pendingAct.a !== "run" && pendingAct.a !== "sleep" && pendingAct.a !== "dance" && pendingAct.a !== "cry") {
      // "dog eating pizza" → pizza is held by dog.
      if (!lastThing.held) {
        lastThing.held = t;
        t.heldBy = lastThing;
        lastThing.act = lastThing.act || pendingAct.a;
      }
      pendingAct = null;
    }
    plan.things.push(t);
    lastThing = t;
    addSeen(label + (t.count > 1 ? ` ×${t.count}` : ""), "thing");
    return t;
  };

  const applyExpand = (ex) => {
    addSeen(ex.label, "idea");
    if (ex.place && !plan.place) plan.place = ex.place;
    if (ex.time && !plan.time) plan.time = ex.time;
    if (ex.weather) plan.weather.push(ex.weather);
    if (ex.season && !plan.season) plan.season = ex.season;
    if (ex.mood) plan.moods.push(ex.mood);
    for (const w of ex.things || []) {
      const hit = LEX[w];
      if (hit && hit.k === "thing") {
        const t = addThing(hit, hit.label, {});
        t.quiet = true;
        seen.pop();
      }
    }
  };

  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i];
    if (tok.emoji) {
      const word = EMOJI[tok.emoji] || EMOJI[tok.emoji.replace(/️/g, "")];
      if (word) {
        // Re-enter the loop with the mapped word.
        toks.splice(i + 1, 0, ...tokenize(word).map((x) => Object.assign(x, { fromEmoji: tok.raw })));
      } else {
        unknown.push({ word: tok.raw, emoji: true });
      }
      continue;
    }
    const w = tok.w;
    let prev = i > 0 ? toks[i - 1].w : null;
    // look past articles: "on the moon" → prev = "on"
    for (let b = i - 1; b >= 0 && toks[b].w && /^(the|a|an|my|our|your|his|her|their|this|that|some)$/.test(toks[b].w); b--) {
      prev = b > 0 ? toks[b - 1].w : null;
    }

    // phrases: try 4, 3, 2 words
    let matched = false;
    for (let n = 4; n >= 2 && !matched; n--) {
      if (i + n > toks.length) continue;
      const slice = toks.slice(i, i + n);
      if (slice.some((s) => !s.w)) continue;
      const phrase = slice.map((s) => s.w).join(" ");
      const phrase2 = slice.map((s) => stemCandidates(s.w)[s === slice[slice.length - 1] ? 0 : 0]).join(" ");
      const ex = EXPAND[phrase] || EXPAND[phrase.replace(/s$/, "")];
      if (ex) {
        applyExpand(ex);
        i += n - 1;
        matched = true;
        break;
      }
      let hit = LEX[phrase] || LEX[phrase2];
      if (!hit && phrase.endsWith("s")) hit = LEX[phrase.slice(0, -1)];
      if (hit) {
        handleEntry(hit, phrase, prev, phrase.endsWith("s") && !LEX[phrase]);
        i += n - 1;
        matched = true;
      }
    }
    if (matched) continue;

    if (/^\d+$/.test(w)) {
      const n = parseInt(w, 10);
      if (n >= 2 && n <= 1000) pendingCount = Math.min(7, n);
      else if (n > 1000) unknown.push({ word: w });
      continue;
    }
    if (NUMBER_WORDS[w] !== undefined && NUMBER_WORDS[w] > 0 && !LEX[w]) {
      pendingCount = NUMBER_WORDS[w];
      continue;
    }
    if (EXPAND_SINGLE[w]) {
      applyExpand(EXPAND[EXPAND_SINGLE[w]]);
      continue;
    }
    if (STOP.has(w)) continue;

    // "light blue", "dark red": a shade word in front of a colour
    if ((w === "light" || w === "dark" || w === "pale" || w === "deep" || w === "bright") && toks[i + 1] && toks[i + 1].w && NAMED_COLORS[toks[i + 1].w]) {
      continue;
    }
    // "draw me a cat": me is the audience, not a subject
    if ((w === "me" || w === "us") && prev && /^(draw|paint|make|show|give|sketch|create)$/.test(prev)) continue;

    // colour-or-thing: "orange cat" vs "an orange"
    if (COLOR_OR_THING.has(w) && NAMED_COLORS[w]) {
      const next = toks[i + 1] && toks[i + 1].w ? lookupWord(toks[i + 1].w) : null;
      const next2 = toks[i + 2] && toks[i + 2].w ? lookupWord(toks[i + 2].w) : null;
      const nextIsThing = (x) => x && x.entry && (x.entry.k === "thing" || x.entry.k === "size") ;
      if (nextIsThing(next) || (next && next.color) || (next && next.entry && next.entry.k === "size" && nextIsThing(next2))) {
        pendingColors.push(NAMED_COLORS[w]);
        addSeen(w, "color");
        continue;
      }
    }

    const look = lookupWord(w);
    andBefore = prev === "and";
    if (look && look.color) {
      const hex = NAMED_COLORS[look.color];
      // "light blue" / "dark red" / "pale pink"
      let col = hex;
      if (prev === "light" || prev === "pale" || prev === "baby" || prev === "soft") col = hex === "rainbow" ? hex : mixHex(hex, "#ffffff", 0.4);
      if (prev === "dark" || prev === "deep") col = hex === "rainbow" ? hex : mixHex(hex, "#000000", 0.35);
      pendingColors.push(col);
      tints.push(col);
      addSeen(look.color, "color");
      continue;
    }
    if (look && look.entry) {
      const isPlural = look.via !== w && /s$/.test(w) && look.via === w.replace(/e?s$/, "") ;
      handleEntry(look.entry, look.via, prev, isPlural || (/(ies|s)$/.test(w) && look.via !== w && !/ing$|ed$/.test(w)));
      continue;
    }
    if (w === "light" || w === "dark" || w === "pale" || w === "deep") {
      if (w === "dark" && !(toks[i + 1] && toks[i + 1].w && lookupWord(toks[i + 1].w) && lookupWord(toks[i + 1].w).color)) {
        if (!plan.time) plan.time = "night";
        addSeen("dark", "time");
      }
      continue;
    }
    // Names → people.
    const capital = tok.raw && /^\p{Lu}/u.test(tok.raw) && i > 0;
    if (NAMES.has(w) || (capital && w.length > 2 && !/^\p{Lu}+$/u.test(tok.raw))) {
      const name = tok.raw.replace(/'s$/i, "");
      // "Mr. Johnson", "Dr Lee": the title already made the person
      if (lastThing && lastThing.title && !lastThing.name && plan.things[plan.things.length - 1] === lastThing) {
        lastThing.name = name;
        seen.pop();
        addSeen(`${lastThing.title} ${name}`, "name");
        continue;
      }
      const t = addThing(LEX.person, name, { name: true });
      t.name = name;
      seen.pop();
      addSeen(t.name, "name");
      continue;
    }
    if (w.length >= 2 || /[^\x00-\x7f]/.test(w)) unknown.push({ word: tok.raw.replace(/'s$/i, ""), verbish: /(ing|ed|ly)$/.test(w) && w.length > 4 });
  }

  function handleEntry(e, via, prev, plural) {
    if (e.k === "thing") {
      if (e.title) {
        const t = addThing(e, e.label, { name: true });
        t.title = via.replace(/^./, (c) => c.toUpperCase());
        return;
      }
      // "on the moon" → place, "a moon" → thing.
      if (e.place && prev && PREP_PLACE.has(prev) && !plan.place) {
        plan.place = e.place;
        addSeen(e.label, "place");
        if (e.time && !plan.time) plan.time = e.time;
        return;
      }
      if (e.time && !plan.time) plan.time = e.time;
      if (e.place === "space") {
        if (!plan.place) plan.place = "space";
      }
      if (pendingAct && (pendingAct.a === "fly" || pendingAct.a === "swim" || pendingAct.a === "run" || pendingAct.a === "sleep" || pendingAct.a === "dance" || pendingAct.a === "cry")) {
        const t = addThing(e, e.label, { plural });
        t.act = pendingAct.a;
        pendingAct = null;
        return;
      }
      addThing(e, e.label, { plural, and: andBefore });
    } else if (e.k === "place") {
      if (!plan.place || (plan.place === "skyonly" && e.p !== "skyonly")) plan.place = e.p;
      else if (plan.place !== e.p) plan.place2 = plan.place2 || e.p;
      addSeen(e.label, "place");
    } else if (e.k === "time") {
      plan.time = e.t;
      addSeen(e.label, "time");
    } else if (e.k === "weather") {
      if (!plan.weather.includes(e.w)) plan.weather.push(e.w);
      addSeen(e.label, "weather");
    } else if (e.k === "season") {
      plan.season = e.s;
      addSeen(e.label, "season");
    } else if (e.k === "mood") {
      if (!plan.moods.includes(e.md)) plan.moods.push(e.md);
      addSeen(e.label, "mood");
    } else if (e.k === "size") {
      pendingSize = e.v;
      addSeen(e.v > 1 ? "big" : "small", "size");
    } else if (e.k === "act") {
      addSeen(e.label, "act");
      if (lastThing && ["fly", "swim", "run", "sleep", "dance", "cry", "study"].includes(e.a)) {
        lastThing.act = e.a;
        plan.acts.push(e.a);
        if (e.a === "study") pendingAct = { a: "hold" };
        return;
      }
      plan.acts.push(e.a);
      pendingAct = { a: e.a };
    }
  }

  // Leftover colours with no noun after them tint the whole painting.
  if (pendingColors.length && plan.things.length && !plan.things[plan.things.length - 1].color) {
    // "a truck that is red" — give it to the last thing.
    plan.things[plan.things.length - 1].color = pendingColors[pendingColors.length - 1];
  }
  // A pending action with no object ("my dog flying") applies to the last thing.
  if (pendingAct && lastThing && !lastThing.act) lastThing.act = pendingAct.a;

  // Nothing at all to go on ("????", "123", "hi"): the whole prompt is the word.
  if (!plan.things.length && !unknown.length && !plan.moods.length && !plan.weather.length && !plan.time && !plan.place && !plan.season && prompt) {
    unknown.push({ word: prompt.slice(0, 24) });
  }

  // Cap the scene so it stays legible and fast.
  if (plan.things.length > 6) plan.things = plan.things.filter((t) => !t.heldBy).slice(0, 6).concat(plan.things.filter((t) => t.heldBy).slice(0, 2));
  if (unknown.length > 6) unknown.length = 6;
  return plan;
}

if (typeof module !== "undefined") module.exports = { parsePrompt, LEX, strHash, mixHex, hslHex };
