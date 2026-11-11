import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('copy_clients', Path(__file__).resolve().parents[1]/'scripts/import_test_clients.py')
copy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(copy)


class TestCopy(unittest.TestCase):
    def test_rejects_production_and_lookalike_destinations(self):
        for url in ['https://ufejapwznsjclmkonwad.supabase.co', 'http://'+copy.TEST_HOST,
                    'https://'+copy.TEST_HOST+'.example.invalid', 'https://'+copy.TEST_HOST+'/rest/v1',
                    'https://'+copy.TEST_HOST+'?project=other']:
            with self.assertRaises(ValueError):
                copy.test_url(url)
        self.assertEqual(copy.test_url('https://'+copy.TEST_HOST+'/'), 'https://'+copy.TEST_HOST)

    def test_rerun_preserves_edited_copies(self):
        source = [{'id':'a','whatsapp':'123','full_name':'Original'}]
        existing = [{'id':'a','whatsapp':'123','full_name':'Edited copy'}]
        self.assertEqual(copy.plan(source, [{'id':'v','client_id':'a'}], existing, [{'id':'v','client_id':'a'}]), ([],[]))
        self.assertEqual(existing[0]['full_name'], 'Edited copy')

    def test_rejects_duplicate_phone_or_orphan_vehicle(self):
        for clients, vehicles, old in [([{'id':'a','whatsapp':'123'}], [], [{'id':'b','whatsapp':'123'}]),
                                       ([{'id':'a','whatsapp':'123'}], [{'id':'v','client_id':'b'}], [])]:
            with self.assertRaises(ValueError):
                copy.plan(clients, vehicles, old, [])

    def test_csv_converts_exported_nulls_and_booleans(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'clients.csv'
            path.write_text('id,full_name,whatsapp,marketing_consent,is_demo,notes,review_request_count\n00000000-0000-0000-0000-000000000001,Test,123,false,false,NULL,0\n')
            row = copy.read_csv(path, 'clients')[0]
            self.assertIs(row['notes'], None)
            self.assertIs(row['marketing_consent'], False)
            self.assertEqual(row['review_request_count'], 0)

    def test_catalog_only_remaps_unique_matching_vehicle(self):
        rows = [{'id':'v','catalog_id':'source-id','brand':' Test ','model':'Model','category':'auto'}]
        catalog = [{'id':'test-id','brand':'TEST','model':'Model','category':'auto'}]
        self.assertEqual(copy.map_catalog(rows,catalog)['foreign_catalog_links_remapped'],1)
        self.assertEqual(rows[0]['catalog_id'],'test-id')
        rows[0]['catalog_id'] = 'source-id'
        self.assertEqual(copy.map_catalog(rows,catalog+catalog)['foreign_catalog_links_omitted'],1)
        self.assertIsNone(rows[0]['catalog_id'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
