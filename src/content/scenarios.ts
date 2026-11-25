import type { Language, Scenario } from '../narrator/types';

type Localized = Record<Language, Omit<Scenario, 'id' | 'imageStyle' | 'ageRating'>>;

const defs: { id: string; imageStyle: string; ageRating: Scenario['ageRating']; text: Localized }[] = [
  {
    id: 'fantasy',
    imageStyle: 'epic fantasy digital painting',
    ageRating: '12',
    text: {
      pt: {
        title: 'Reino de Valdren',
        description: 'Um reino medieval de castelos, dragões adormecidos e magia antiga. O rei morreu sem herdeiros e as casas nobres disputam o trono enquanto criaturas saem das montanhas.',
        tone: 'épico, aventureiro, com humor ocasional',
        opening: 'Comece a aventura: o personagem chega à vila de Pedra-Funda numa noite de tempestade, quando um sino de alarme começa a tocar.',
      },
      en: {
        title: 'Kingdom of Valdren',
        description: 'A medieval realm of castles, sleeping dragons and ancient magic. The king died without heirs; noble houses fight for the throne while creatures pour out of the mountains.',
        tone: 'epic, adventurous, with occasional humor',
        opening: 'Begin the adventure: the character arrives at the village of Deepstone on a stormy night, just as an alarm bell starts ringing.',
      },
    },
  },
  {
    id: 'cyberpunk',
    imageStyle: 'neon cyberpunk concept art',
    ageRating: '14',
    text: {
      pt: {
        title: 'Neo-São Paulo 2099',
        description: 'Uma megacidade de arranha-céus, chuva ácida e corporações que mandam em tudo. Implantes cibernéticos são comuns e informação vale mais que ouro.',
        tone: 'noir, tenso, estiloso',
        opening: 'Comece a aventura: o personagem acorda num motel barato com uma mensagem criptografada piscando no implante ocular e alguém batendo na porta.',
      },
      en: {
        title: 'Neo-Tokyo 2099',
        description: 'A megacity of towering skyscrapers, acid rain and all-powerful corporations. Cybernetic implants are common and information is worth more than gold.',
        tone: 'noir, tense, stylish',
        opening: 'Begin the adventure: the character wakes in a cheap motel with an encrypted message blinking in their eye implant and someone knocking at the door.',
      },
    },
  },
  {
    id: 'horror',
    imageStyle: 'dark atmospheric horror illustration',
    ageRating: '16',
    text: {
      pt: {
        title: 'A Mansão Ravenwood',
        description: 'Uma mansão isolada no interior, onde uma família desapareceu há 50 anos. Coisas se movem no escuro e a casa parece ter vontade própria.',
        tone: 'suspense, terror psicológico, sem violência explícita',
        opening: 'Comece a aventura: o personagem chega à mansão ao anoitecer, convidado por uma carta sem remetente. A porta da frente se abre sozinha.',
      },
      en: {
        title: 'Ravenwood Manor',
        description: 'An isolated countryside mansion where a family vanished 50 years ago. Things move in the dark and the house seems to have a will of its own.',
        tone: 'suspense, psychological horror, no explicit violence',
        opening: 'Begin the adventure: the character arrives at the mansion at dusk, invited by a letter with no sender. The front door opens by itself.',
      },
    },
  },
  {
    id: 'space',
    imageStyle: 'cinematic sci-fi space art',
    ageRating: '12',
    text: {
      pt: {
        title: 'Fronteira Estelar',
        description: 'A humanidade colonizou dezenas de sistemas. Piratas, alienígenas misteriosos e ruínas de uma civilização antiga esperam além da fronteira.',
        tone: 'aventura espacial, descoberta, otimista',
        opening: 'Comece a aventura: a nave do personagem sai do hiperespaço com o motor danificado, perto de uma estação abandonada que ainda emite um sinal de socorro.',
      },
      en: {
        title: 'Star Frontier',
        description: 'Humanity has colonized dozens of systems. Pirates, mysterious aliens and the ruins of an ancient civilization wait beyond the frontier.',
        tone: 'space adventure, discovery, hopeful',
        opening: 'Begin the adventure: the character\'s ship drops out of hyperspace with a damaged engine, next to an abandoned station still broadcasting a distress signal.',
      },
    },
  },
  {
    id: 'apocalypse',
    imageStyle: 'post-apocalyptic gritty concept art',
    ageRating: '14',
    text: {
      pt: {
        title: 'Terra Cinza',
        description: 'Vinte anos depois do colapso. Cidades em ruínas, comunidades sobreviventes, recursos escassos e perigos mutantes no deserto.',
        tone: 'sobrevivência, dramático, esperança em meio ao caos',
        opening: 'Comece a aventura: a água do abrigo do personagem acabou, e ele precisa atravessar a cidade em ruínas até um mercado de trocas antes do anoitecer.',
      },
      en: {
        title: 'Ashlands',
        description: 'Twenty years after the collapse. Ruined cities, survivor communities, scarce resources and mutant dangers in the wasteland.',
        tone: 'survival, dramatic, hope amid chaos',
        opening: 'Begin the adventure: the character\'s shelter has run out of water, and they must cross the ruined city to a trading post before nightfall.',
      },
    },
  },
  {
    id: 'magic-school',
    imageStyle: 'whimsical storybook illustration',
    ageRating: 'L',
    text: {
      pt: {
        title: 'Academia Arcana',
        description: 'Uma escola de magia num castelo flutuante. Aulas encantadas, rivalidades entre casas, criaturas mágicas e um segredo escondido na biblioteca proibida.',
        tone: 'mágico, divertido, cheio de mistério',
        opening: 'Comece a aventura: é o primeiro dia do personagem na Academia Arcana, e a varinha dele começa a brilhar de um jeito que assusta até os professores.',
      },
      en: {
        title: 'Arcane Academy',
        description: 'A school of magic in a floating castle. Enchanted classes, house rivalries, magical creatures and a secret hidden in the forbidden library.',
        tone: 'magical, fun, full of mystery',
        opening: 'Begin the adventure: it is the character\'s first day at the Arcane Academy, and their wand starts glowing in a way that frightens even the teachers.',
      },
    },
  },
];

export function getScenarios(lang: Language): Scenario[] {
  return defs.map((d) => ({ id: d.id, imageStyle: d.imageStyle, ageRating: d.ageRating, ...d.text[lang] }));
}

export function customScenario(lang: Language, title: string, description: string): Scenario {
  return {
    id: 'custom',
    title: title.trim() || (lang === 'pt' ? 'Aventura personalizada' : 'Custom adventure'),
    description: description.trim(),
    tone: lang === 'pt' ? 'definido pela descrição' : 'as described',
    opening: lang === 'pt' ? 'Comece a aventura com uma cena de abertura marcante baseada no cenário.' : 'Begin the adventure with a striking opening scene based on the scenario.',
    imageStyle: '',
    ageRating: '12',
  };
}
