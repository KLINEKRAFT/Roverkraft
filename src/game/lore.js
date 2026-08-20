/* ============================================================
   LORE — codex, samples, missions
   ------------------------------------------------------------
   Text and data only. The objective LOGIC lives in gameplay.js, but what an
   objective watches for is declared here, in the `watch` field, so a mission
   can be written without editing code and without renumbering anything.

   Setting: Philolaus, 72.1° N. A real crater, chosen because of what is
   actually in it — candidate pits, small rimless collapses along a buried
   lava channel, whose interiors at this latitude never see the sun. Those
   are cold traps. What a cold trap does is keep things.
   ============================================================ */

export const CODEX = [
  {
    id: 'dossier', tag: 'DOSSIER', title: 'OPERATION NORTHFIELD', meta: 'NORTHFIELD COMMISSION · LICENCE 44-C',
    start: true,
    body: [
      `Philolaus sits at 72.1° north, near enough the limb that Earth never clears the rim wall by more than a hand's width and the sun never climbs past nineteen degrees. Shadows here do not shorten at midday. They only turn.`,
      `KEEL-4 was licensed to prospect volatiles: ice, and whatever else the cold has been holding on to. The Commission's interest is water, which at this distance is fuel, which is the only commodity on this body worth the freight.`,
      `The station reported nominal for six hundred and eleven days. On day six hundred and twelve it sent nine seconds of unmodulated carrier and stopped. That was two hundred and fourteen days ago.`,
      `You are the operator of K6 MERIDIAN, put down by descent sled on the basin floor, east of the station and east of the collapse. Survey. Sample. Restore the relay chain. Establish why KEEL-4 stopped talking.`,
      `The licence is appended in full. It runs to forty pages and it does not, anywhere, use the word ice.`
    ]
  },
  {
    id: 'geology', tag: 'PRIMER', title: 'THE FLOOR OF PHILOLAUS', meta: 'SURVEY PRIMER · REV 12',
    start: true,
    body: [
      `Regolith is not sand. It is powdered rock that has been shattered, welded, shattered again and salted with meteoritic iron for four billion years, with no water and no wind to round a single grain. Every particle is a splinter. It packs to about forty per cent void, it holds a footprint indefinitely, and it will grind through a bearing seal in a season.`,
      `It does not dig the same everywhere, whatever the manual says. Mature basin floor carries a wheel. Fresh ejecta is coarse and firm and gives you traction you will come to rely on. The talus under the rim is loose to a depth nobody has measured, and there are patches out on the flat — deceptively level, slightly darker, no relief to speak of — that will take the machine to its axles in under two metres.`,
      `The rule for all of them is the same: sinkage grows with slip. A wheel that is turning faster than the ground is moving is not driving, it is excavating, and it is excavating downward. Ease off and it stops getting worse. Hold the throttle and it will not.`,
      `At one sixth of a gravity your wheels have one sixth of the grip. Brake early.`
    ]
  },
  {
    id: 'first-return', tag: 'FIELD NOTE', title: 'THE FIRST RETURN', meta: 'GPR · SUBSURFACE ECHO 001',
    body: [
      `The radar came back wrong on the first sweep of the day.`,
      `A buried boulder returns one hard hyperbola. Bulk ice returns a broad, low-velocity smear, and that is what I was expecting, because that is what we are licensed to find.`,
      `What came back from four metres under the basin floor is a network. Branching, roughly dendritic, coherent across sixty metres and continuing past the aperture in both directions. The dielectric reads like ice, but ice does not branch. Ice fills what is already there.`,
      `Which means something was already there, and the ice found it.`,
      `Recommend excavation.`
    ]
  },
  {
    id: 'veins', tag: 'ANALYSIS', title: 'THE VOLATILE VEINS', meta: 'SAMPLE 007 · MASS SPEC + PETROGRAPHY',
    body: [
      `The core is a plug of dirty water ice with a rind of regolith welded to it, recovered at 3.9 m and kept below 130 K the whole way to the sled, which took some doing.`,
      `It is layered. Not banded, not foliated — LAYERED, in couplets of a bright fraction and a dark fraction, forty to sixty microns each, running for the entire ninety millimetres of the plug without a break.`,
      `There is no weather on the Moon. There is no season. There is no mechanism at this depth that lays down anything in couplets, and the only thing that varies here on a regular cadence is the sun going round the horizon once a month, and it does not reach four metres down.`,
      `The veins are not a deposit. They are a record of something arriving at intervals, and they run downhill, west, toward the collapse.`,
      `I have not written the obvious next sentence in this note. Halvorsen can write it if she wants it in the record.`
    ]
  },
  {
    id: 'roster', tag: 'PERSONNEL', title: 'KEEL-4 CREW', meta: 'FOUR SOULS · ROTATION 7',
    body: [
      `HALVORSEN, I. — station lead, geophysics. Third rotation. Wrote most of the logs and all of the good ones.`,
      `OKONKWO, A. — power and thermal. Kept a chess game going with somebody in Houston, one move per uplink window, and was losing gracefully.`,
      `REYES, M. — medical, and the only crew member qualified on the deep rig.`,
      `TANAKA-BRUUN, S. — Commission liaison. No published field record. No published anything, in fact. Arrived with the last resupply and was not on the manifest.`,
      `All four are listed as MISSING. Not lost. The distinction is a legal one and the Commission has been careful about it in every document it has released, including this one.`
    ]
  },
  {
    id: 'log6', tag: 'STATION LOG', title: 'SUN-DAY 6', meta: 'I. HALVORSEN · TRANSCRIPT',
    body: [
      `Reyes has the vein network mapped out to two hundred metres and it is not a network, it is a drainage. Everything runs downhill to the collapse. The pit is the low point of a catchment that has no liquid in it and has not had for three billion years.`,
      `Cold traps do not fill from the side. They fill from above, one molecule at a time, when something transient wanders past and freezes out. That is the whole textbook: a cold trap is a place where the Moon keeps its post.`,
      `So we have a catchment full of layered ice draining into a hole that never sees the sun, and the layers are regular, and I am the station lead, and I am going to write down the thing everyone here has been carefully not saying:`,
      `Something has been coming back.`,
      `Tanaka-Bruun asked me to leave that out. I told her the log is the log. She said something I have been chewing on since, which was: "the log is a transmission."`
    ]
  },
  {
    id: 'log11', tag: 'STATION LOG', title: 'SUN-DAY 11', meta: 'I. HALVORSEN · TRANSCRIPT · PARTIAL',
    body: [
      `We took the rig down into the pit.`,
      `The floor is glass — impact melt, ponded, then covered by two centimetres of dust that has fallen so slowly you can read the year in it if you have the patience. Under the glass, forty metres of stratified volatile.`,
      `Okonkwo counted eleven thousand couplets before he stopped counting. If a couplet is a passage, and the spacing holds, then whatever this is has a period of about three hundred and nine years and it has kept it, without drifting, for three and a half million.`,
      `Nothing natural keeps time that well. Not orbits, not precession, not us.`,
      `There is one break in the sequence. One layer, about a third of the way down, four millimetres thick where every other is fifty microns, and chemically nothing like the rest. It is not ice. Reyes has it in a nitrogen flask and will not put it down.`,
      `The lamps are the problem. Everything we light, we lose — the surface sublimes off the working face while we look at it and takes the top four or five couplets with it. We are reading the record by burning it. There is no version of this where we get to do both.`
    ]
  },
  {
    id: 'memo', tag: 'COMMISSION', title: 'MEMORANDUM 44-C', meta: 'RECOVERED FROM RELAY CACHE · UNSENT',
    body: [
      `TO: Station Lead, KEEL-4`,
      `FROM: Commission Oversight, Northfield`,
      `RE: Cessation of unauthorised subsurface work`,
      `Your survey exceeds the scope of the volatile-prospecting charter under which KEEL-4 is licensed and insured. All excavation below two metres is to stop immediately. Instrumentation already emplaced in the formation is to be left in place and left powered.`,
      `For the avoidance of doubt: the formation was catalogued prior to your arrival. It is Commission property under the salvage provisions. Your crew was not selected for its discovery and will not be credited with it.`,
      `Liaison Tanaka-Bruun holds standing authority on all matters relating to the formation, including the authority to terminate the rotation early.`,
      `You are reminded that the station's power is drawn from a tap the Commission installed and the Commission maintains.`
    ]
  },
  {
    id: 'horizon', tag: 'ANALYSIS', title: 'THE HORIZON', meta: 'SAMPLE 019 · THE ANOMALOUS LAYER',
    body: [
      `The break in the sequence is not ice and it is not rock.`,
      `It is a mineral phase with a crystal habit that does not appear in any lunar sample ever returned, or any meteorite, or any laboratory. It is thermodynamically fine — nothing here is impossible — it is simply not a thing that has been observed to happen anywhere, which is a different and much worse problem.`,
      `Its distribution is the part I cannot put down. It is not a lens and it is not a plume. It is a HORIZON: flat, four millimetres, of uniform thickness across every metre of the pit floor we have sampled, which means it was laid down everywhere at once.`,
      `Above it, fifty-micron couplets, three hundred and nine years apart, all the way to the glass.`,
      `Below it, fifty-micron couplets, three hundred and nine years apart, all the way down as far as the string reaches.`,
      `Whatever has been coming here every three centuries did something different, once, three point two million years ago, and then went back to the schedule.`
    ]
  },
  {
    id: 'lasthour', tag: 'STATION LOG', title: 'THE LAST HOUR', meta: 'I. HALVORSEN · UNSENT · RECOVERED FROM LOCAL STORE',
    body: [
      `The pit is fogging.`,
      `Not venting — fogging, evenly, off the whole floor at once, and the gauge in the shaft has gone from ten to the minus twelve to ten to the minus six in ninety minutes. Okonkwo says that is not a leak, that is a phase change, and a phase change needs energy, and we have not put any in.`,
      `Tanaka-Bruun has locked out the tap. She is not hostile about it. She has been perfectly polite. She says the event is scheduled, that it has always been scheduled, that the interval is in the annex and we did not read the annex.`,
      `I asked her what the interval was. She said three hundred and nine years, and then she apologised, which was worse.`,
      `Reyes is getting the suits. Okonkwo is trying to get the hab off the tap and onto the array.`,
      `If you are reading this you drove here, which means the relays are up, which means you can send. So send it. All of it, the veins and the couplets and the horizon and the arithmetic, and do not let them tell you it was an equipment failure:`,
      `It is not a fault. It is an appointment. Somebody wrote it down and did not tell the people standing on the spot.`,
      `Sun-day 14. Halvorsen out. Tell my brother the chess game goes to Okonkwo.`
    ]
  },
  {
    id: 'core', tag: 'FIELD NOTE', title: 'WHAT THE CORE SAYS', meta: 'PIT FLOOR · 11 m SUBSURFACE',
    body: [
      `Eleven metres down, under the glass and under eleven thousand couplets, the record stops being a record.`,
      `The bottom of the string came up warm. Minus one hundred and sixty-one on the pit floor, minus ninety-four at depth, and the gradient is the wrong way round for anything geological — there is nothing left in this body to keep a crater floor warm, and there has not been for three billion years.`,
      `Something down there has been dissipating power continuously since well before the station arrived, and the couplets above it are thinner in the last four hundred years than they are anywhere else in the column, which is what you would expect if the floor had been getting steadily less cold.`,
      `The cold trap is failing. Slowly, from underneath.`,
      `At the present rate the pit stops being a cold trap in about eleven months, and everything it has been keeping for three and a half million years goes back into the exosphere over a single lunation.`,
      `The next couplet is due in forty-one years. There will not be a floor left to write it on.`
    ]
  },
  {
    id: 'transmission', tag: 'ENDING', title: 'TRANSMISSION', meta: 'RELAY CHAIN NOMINAL · UPLINK WINDOW OPEN',
    body: [
      `The relays are up. Earth is eleven degrees above the northern rim, blue and half-lit and one and a quarter seconds away.`,
      `You have the crew logs, the vein analyses, the horizon, the memo they never sent, and a timestamped thermal profile of a cold trap failing from below with four names still legally listed as missing.`,
      `The Commission maintains this uplink. The Commission will receive this first.`,
      `Halvorsen knew that, and wrote it down anyway, and then walked out to help Okonkwo get the hab onto the array, which was never going to work and which he did regardless.`,
      `K6 MERIDIAN, Philolaus basin, sun-day 228.`,
      `Transmitting.`
    ]
  }
];

/* ---------------- sample taxonomy ----------------
   Six ordinary units the Moon actually has, and three that are why you came.
   `unlock` fires a codex entry the first time one reaches the sled. */
export const SAMPLES = {
  regolith:    { name: 'REGOLITH CORE', rare: false, value: 1, desc: 'Mature basin soil. 40 % void, 3 % meteoritic iron, agglutinate-rich.' },
  breccia:     { name: 'IMPACT BRECCIA', rare: false, value: 2, desc: 'Shattered rock welded by shock. Someone else\'s crater, delivered here.' },
  ilmenite:    { name: 'ILMENITE CONCENTRATE', rare: false, value: 2, desc: 'FeTiO₃. The reason anyone would ever want to own this basin.' },
  agglutinate: { name: 'AGGLUTINATE', rare: false, value: 2, desc: 'Soil welded to itself by micrometeorite glass. Pure lunar weathering.' },
  pyroclast:   { name: 'PYROCLASTIC BEADS', rare: true, value: 4, desc: 'Orange volcanic glass. Fire-fountained from 400 km down, 3.6 Gy ago.' },
  meteoritic:  { name: 'METEORITIC IRON', rare: true, value: 4, desc: 'Kamacite fragment. Arrived at eighteen kilometres per second.' },
  vein:        { name: 'VOLATILE VEIN CORE', rare: true, value: 6, desc: 'Layered water ice in fifty-micron couplets. Nothing here has seasons.', unlock: 'veins' },
  horizon:     { name: 'HORIZON LAYER', rare: true, value: 8, desc: 'Four millimetres of a mineral phase with no observed occurrence. Flat everywhere.', unlock: 'horizon' },
  deep:        { name: 'PIT FLOOR DEEP CORE', rare: true, value: 12, desc: 'Warm at eleven metres. The gradient is the wrong way round.', unlock: 'core' }
};

/* ---------------- missions ----------------
   Five, in the order the fiction needs them:

     the relays come BEFORE the descent, because there is no line of sight out
     of a pit and that is the reason the relay chain exists at all. Upstream
     ran the station beat last; here the station is what sends you down.

   `watch` is read by Game._watchObjectives. `reveals` marks a point of
   interest as known to the map and the compass; `grants` unlocks a capability
   the world tests for by name. Neither is a mission INDEX comparison — those
   were the thing that made inserting a mission dangerous. */
export const MISSIONS = [
  {
    id: 'coldstart', tag: 'MISSION 01', name: 'COLD START',
    brief: `The sled is down and you are on the surface. Deploy the array, wake the drive train, and get the feel of one sixth of a gravity before you need it.\n\nEverything about this machine is tuned for a world that pulls harder than this one. It will go where you point it. It will not stop where you expect.`,
    objectives: [
      { id: 'deploy', text: 'Deploy the solar array', hint: 'ARRAY, in the status tray' },
      { id: 'drive', text: 'Drive 120 m from the sled', watch: { kind: 'far', poi: 'HOME', m: 120 } },
      { id: 'scan', text: 'Run one ground-penetrating radar sweep', hint: 'SCAN' }
    ]
  },
  {
    id: 'firstecho', tag: 'MISSION 02', name: 'FIRST ECHO',
    brief: `The radar is returning a branching network four metres under the basin floor, coherent past the aperture in both directions. The licence says ice. Ice does not branch.\n\nSweep, drive to the return, park, put the drill through it. Three of them, then bring them back — a sample in the bay is a sample you can still lose.`,
    objectives: [
      { id: 'find3', text: 'Excavate 3 subsurface returns', count: 3 },
      // no `watch`: stowing is an EVENT, raised by the sled when it takes the
      // bay. `watch` is for states of the world the mission can test for.
      { id: 'home1', text: 'Return the samples to the sled' }
    ]
  },
  {
    id: 'station', tag: 'MISSION 03', name: 'THE SILENT STATION',
    brief: `KEEL-4 is three hundred and forty metres west-northwest, on the far side of the rille. There is one crossing, where the graben roof came down — everywhere else the walls are past the angle of repose and you will not come back out.\n\nGet inside the perimeter and pull whatever is left of the local store. Mind the scorch ring on the approach: the ground there is glass under a centimetre of dust, and glass under dust is the only truly frictionless surface on this body.`,
    reveals: ['STATION'],
    objectives: [
      { id: 'reach', text: 'Reach KEEL-4', watch: { kind: 'near', poi: 'STATION', m: 26 },
        on: { unlock: 'roster', log: ['KEEL-4 PERIMETER — NO POWER SIGNATURE', 'warn'] } },
      { id: 'recover', text: 'Recover the crew logs', hint: 'hold at the airlock' }
    ]
  },
  {
    id: 'lineofsight', tag: 'MISSION 04', name: 'LINE OF SIGHT',
    brief: `Halvorsen's logs end pointing down the catchment, at the collapse. You are going in after them, and the moment you are below the rim you have no sky, no Earth and no uplink.\n\nSo build one first. Three relays on high ground — the terraces under the rim wall, or the ridge east of the pit — ninety-five metres apart and above ten. The chain is what carries you back out with anything worth carrying.`,
    reveals: ['PIT'],
    objectives: [
      { id: 'relays', text: 'Deploy 3 relays on high ground', count: 3,
        hint: 'RELAY, on ground above 10 m, 95 m apart' }
    ]
  },
  {
    id: 'descent', tag: 'MISSION 05', name: 'THE DESCENT',
    brief: `The pit is ninety metres across and the interior has not been in sunlight since the collapse. Your array will do nothing down there. Your lamps will do everything, including the harm.\n\nDrive in on the talus ramp on the northern lip. Take the deep core off the floor. Then drive back out, because nothing you learn down there matters until it is on the far end of the chain you just built.`,
    grants: ['deepString'],
    objectives: [
      { id: 'enter', text: 'Descend into the pit', watch: { kind: 'near', poi: 'PIT', m: 40, maxH: -6 },
        on: { log: ['PIT INTERIOR — NO SOLAR, NO LINE OF SIGHT', 'warn'] } },
      { id: 'deep', text: 'Extract the pit floor deep core', hint: '11 m string; you are carrying it now' },
      { id: 'transmit', text: 'Return to the sled and transmit' }
    ]
  }
];
