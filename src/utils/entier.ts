/**
 * Entier lu dans une valeur saisie, quel que soit son type : chaîne d'un
 * champ, nombre, ou rien. NaN si la valeur n'en contient pas.
 *
 * Les champs des conditions de micro-régulation sont tantôt des chaînes,
 * tantôt des nombres, parfois absents ; `parseInt` n'accepte que des chaînes.
 */
export const entier = (v: unknown): number => parseInt(String(v), 10);
