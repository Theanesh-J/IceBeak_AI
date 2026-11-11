// Curated regulatory source library.
//
// Every excerpt below was transcribed verbatim from the English Official Journal
// text on EUR-Lex (checked 11 Nov 2026). Excerpts are the original adopted text;
// later amendments (e.g. to annexes of 1223/2009) are not reflected. This file
// holds ONLY source text and metadata. Explanations shown in the app are written
// by the rule engine and are displayed separately from these excerpts.

export interface Provision {
  id: string;
  label: string; // e.g. "Annex, criterion 3(1)"
  excerpt: string;
}

export interface RegulatorySource {
  id: string;
  shortName: string;
  title: string;
  url: string;
  publisher: string;
  publication: string;
  checkedOn: string;
  provisions: Provision[];
}

export const SOURCES: RegulatorySource[] = [
  {
    id: 'eu-655-2013',
    shortName: 'Regulation (EU) No 655/2013',
    title:
      'Commission Regulation (EU) No 655/2013 laying down common criteria for the justification of claims used in relation to cosmetic products',
    url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32013R0655',
    publisher: 'EUR-Lex · Publications Office of the European Union',
    publication: 'OJ L 190, 11.7.2013, p. 31',
    checkedOn: '2026-11-11',
    provisions: [
      {
        id: 'art1',
        label: 'Article 1',
        excerpt:
          'This Regulation shall apply to claims in the form of texts, names, trademarks, pictures and figurative or other signs that convey explicitly or implicitly product characteristics or functions in the labelling, the making available on the market and advertising of cosmetic products. It shall apply to any claim, irrespective of the medium or type of marketing tool used, the product functions claimed, and the target audience.',
      },
      {
        id: 'art2',
        label: 'Article 2',
        excerpt:
          'The responsible person referred to in Article 4 of Regulation (EC) No 1223/2009 shall ensure that the wording of the claim in relation to cosmetic products is in compliance with the common criteria set out in the Annex and is consistent with the documentation proving the effect claimed for the cosmetic product in the product information file referred to in Article 11 of Regulation (EC) No 1223/2009.',
      },
      {
        id: 'c1-1',
        label: 'Annex, 1. Legal compliance (1)',
        excerpt:
          'Claims that indicate that the product has been authorised or approved by a competent authority within the Union shall not be allowed.',
      },
      {
        id: 'c1-2',
        label: 'Annex, 1. Legal compliance (2)',
        excerpt:
          'The acceptability of a claim shall be based on the perception of the average end user of a cosmetic product, who is reasonably well-informed and reasonably observant and circumspect, taking into account social, cultural and linguistic factors in the market in question.',
      },
      {
        id: 'c2-1',
        label: 'Annex, 2. Truthfulness (1)',
        excerpt:
          'If it is claimed on the product that it contains a specific ingredient, the ingredient shall be deliberately present.',
      },
      {
        id: 'c2-2',
        label: 'Annex, 2. Truthfulness (2)',
        excerpt:
          'Ingredient claims referring to the properties of a specific ingredient shall not imply that the finished product has the same properties when it does not.',
      },
      {
        id: 'c3-1',
        label: 'Annex, 3. Evidential support (1)',
        excerpt:
          'Claims for cosmetic products, whether explicit or implicit, shall be supported by adequate and verifiable evidence regardless of the types of evidential support used to substantiate them, including where appropriate expert assessments.',
      },
      {
        id: 'c3-3',
        label: 'Annex, 3. Evidential support (3)',
        excerpt:
          'Where studies are being used as evidence, they shall be relevant to the product and to the benefit claimed, shall follow well-designed, well-conducted methodologies (valid, reliable and reproducible) and shall respect ethical considerations.',
      },
      {
        id: 'c3-4',
        label: 'Annex, 3. Evidential support (4)',
        excerpt:
          'The level of evidence or substantiation shall be consistent with the type of claim being made, in particular for claims where lack of efficacy may cause a safety problem.',
      },
      {
        id: 'c3-6',
        label: 'Annex, 3. Evidential support (6)',
        excerpt:
          'A claim extrapolating (explicitly or implicitly) ingredient properties to the finished product shall be supported by adequate and verifiable evidence, such as by demonstrating the presence of the ingredient at an effective concentration.',
      },
      {
        id: 'c4-1',
        label: 'Annex, 4. Honesty (1)',
        excerpt: 'Presentations of a product’s performance shall not go beyond the available supporting evidence.',
      },
      {
        id: 'c4-2',
        label: 'Annex, 4. Honesty (2)',
        excerpt:
          'Claims shall not attribute to the product concerned specific (i.e. unique) characteristics if similar products possess the same characteristics.',
      },
    ],
  },
  {
    id: 'ec-1223-2009',
    shortName: 'Regulation (EC) No 1223/2009',
    title: 'Regulation (EC) No 1223/2009 of the European Parliament and of the Council of 30 November 2009 on cosmetic products',
    url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32009R1223',
    publisher: 'EUR-Lex · Publications Office of the European Union',
    publication: 'OJ L 342, 22.12.2009, p. 59',
    checkedOn: '2026-11-11',
    provisions: [
      {
        id: 'art2-1a',
        label: 'Article 2(1)(a)',
        excerpt:
          '‘cosmetic product’ means any substance or mixture intended to be placed in contact with the external parts of the human body (epidermis, hair system, nails, lips and external genital organs) or with the teeth and the mucous membranes of the oral cavity with a view exclusively or mainly to cleaning them, perfuming them, changing their appearance, protecting them, keeping them in good condition or correcting body odours',
      },
      {
        id: 'art4-1',
        label: 'Article 4(1)',
        excerpt:
          'Only cosmetic products for which a legal or natural person is designated within the Community as ‘responsible person’ shall be placed on the market.',
      },
      {
        id: 'art10-1',
        label: 'Article 10(1)',
        excerpt:
          'In order to demonstrate that a cosmetic product complies with Article 3, the responsible person shall, prior to placing a cosmetic product on the market, ensure that the cosmetic product has undergone a safety assessment on the basis of the relevant information and that a cosmetic product safety report is set up in accordance with Annex I.',
      },
      {
        id: 'art11-1',
        label: 'Article 11(1)',
        excerpt:
          'When a cosmetic product is placed on the market, the responsible person shall keep a product information file for it. The product information file shall be kept for a period of ten years following the date on which the last batch of the cosmetic product was placed on the market.',
      },
      {
        id: 'art13-1',
        label: 'Article 13(1)',
        excerpt:
          'Prior to placing the cosmetic product on the market the responsible person shall submit, by electronic means, the following information to the Commission:',
      },
      {
        id: 'art19-1b',
        label: 'Article 19(1)(b)',
        excerpt:
          'the nominal content at the time of packaging, given by weight or by volume, except in the case of packaging containing less than five grams or five millilitres, free samples and single-application packs;',
      },
      {
        id: 'art19-5',
        label: 'Article 19(5)',
        excerpt:
          'The language of the information mentioned in points (b), (c), (d) and (f) of paragraph 1 and in paragraphs (2), (3) and (4) shall be determined by the law of the Member States in which the product is made available to the end user.',
      },
      {
        id: 'art20-1',
        label: 'Article 20(1)',
        excerpt:
          'In the labelling, making available on the market and advertising of cosmetic products, text, names, trade marks, pictures and figurative or other signs shall not be used to imply that these products have characteristics or functions which they do not have.',
      },
    ],
  },
];

export function getProvision(sourceId: string, provisionId: string) {
  const source = SOURCES.find((s) => s.id === sourceId);
  const provision = source?.provisions.find((p) => p.id === provisionId);
  return source && provision ? { source, provision } : undefined;
}

/** Topics the engine recognises but for which no curated source is loaded. */
export const KNOWN_SOURCE_GAPS = {
  freeFrom: '“Free from” claims. EU guidance exists, but it isn’t loaded or checked here yet.',
  natural: '“Natural” or “naturally derived” claims. No standard is loaded yet.',
  sensitive: '“Sensitive skin” claims. No loaded source says what evidence they need.',
  germanLaw: 'German label-language rules (set nationally under Article 19(5)). A German specialist must confirm them.',
};
