// Acciones de cocina con ilustración propia en la app.
export const ACTIONS = [
  "chop", "peel", "grate", "mix", "whisk", "blend", "knead", "boil",
  "fry", "bake", "grill", "drain", "season", "rest", "assemble", "serve",
] as const;
export type Action = (typeof ACTIONS)[number];

const RULES: [Action, RegExp][] = [
  ["bake", /horn|four|bake|oven|gratin|enfourn/],
  ["grill", /parrill|\basa(r|d)|grill|barbec|braise|brasa/],
  ["fry", /fr[ie]|sofr|salte|dor[ae]|sauté|poêl|poel|fry|sear|brown|rissol/],
  ["boil", /herv|cuec|cocin.*agua|cocer|bouill|mijot|simmer|boil|blanch|caldo|hierv/],
  ["drain", /escurr|colar|égoutt|egoutt|drain|strain|tamis/],
  ["blend", /lic[uú]|procesa|mix(eur|er)|blend|purée|pure|moul/],
  ["whisk", /bat[ia]|batir|fouett|whisk|beat|emuls/],
  ["knead", /amas|pétr|petr|knead|estir|abaiss|roll out|masa/],
  ["grate", /rall|râp|rap[ée]|grate|zest/],
  ["peel", /pel[ae]|épluch|eplucher|peel|desgran|égren/],
  ["chop", /pic[ae]|cort|trozo|dados|émin|hach|coup|chop|dice|slice|mince|julien/],
  ["season", /sazon|sal(e|ar)\b|pimient|assaison|season|salt|pepper|marin|adob/],
  ["rest", /repos|refri|enfri|deja|laisser|rest|chill|cool|réfrig|refrig|congel|freez/],
  ["assemble", /arm[ae]|rellen|mont[ae]|forr|farc|garn|assemble|layer|capa|étag|fill|stuff|enrol|roll/],
  ["serve", /sirv|servir|serv|emplat|decor|garnish|acompa|plate/],
  ["mix", /mezcl|revuel|incorpor|integr|mélang|melang|ajout|agreg|añad|mix|stir|combine|add/],
];

export function guessAction(text: string): Action {
  const t = text.toLowerCase();
  for (const [a, re] of RULES) if (re.test(t)) return a;
  return "mix";
}
