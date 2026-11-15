import unittest

from adapt import adapt


class AdaptComparisonTests(unittest.TestCase):
    def test_selects_translation_with_more_required_glossary_terms(self):
        result = adapt(
            "face cream",
            "Hautcreme",
            "Gesichtscreme",
            {"preferred": {"face cream": "Gesichtscreme"}, "do_not_translate": []},
        )

        self.assertEqual(result["selected_model"], "nllb")
        self.assertEqual(result["localised"], "Gesichtscreme")
        self.assertIn("more required glossary terms", result["selection_reason"])

    def test_tie_breaks_to_gemma_and_flags_disagreement(self):
        result = adapt(
            "daily care",
            "Tägliche Pflege",
            "Pflege für jeden Tag",
            {"preferred": {}, "do_not_translate": []},
        )

        self.assertEqual(result["selected_model"], "gemma")
        self.assertTrue(result["needs_native_review"])
        self.assertIn("tied", result["selection_reason"])
        self.assertIn("Models produced different translations: review recommended", result["changes"])


if __name__ == "__main__":
    unittest.main()
