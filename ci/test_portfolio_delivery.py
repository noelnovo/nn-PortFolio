import pathlib
import unittest

from portfolio_delivery import PULL_IMAGE, REPOSITORY, update_manifest


class PortfolioDeliveryTests(unittest.TestCase):
    def test_replaces_only_the_canonical_image(self):
        source = 'spec:\n  replicas: 1\n  image: ' + PULL_IMAGE + ':0.1.0-old\n'
        expected = source.replace(':0.1.0-old', ':0.1.0-abcdef1')
        self.assertEqual(update_manifest(source, '0.1.0-abcdef1'), expected)

    def test_rejects_missing_legacy_or_duplicate_references(self):
        for source in ['image: nginx:1.29\n',
            'image: registry.int.downops.win/portfolio/nn-portfolio:old\n',
            ('image: ' + PULL_IMAGE + ':old\n') * 2]:
            with self.assertRaises(ValueError):
                update_manifest(source, '0.1.0-abcdef1')

    def test_rejects_mutable_or_unsafe_tags(self):
        for tag in ['latest', '', '0.1.0', '0.1.0-abcdef1\nimage: attacker:latest', '0.1.0-abcdefg']:
            with self.assertRaises(ValueError):
                update_manifest('image: ' + PULL_IMAGE + ':old\n', tag)

    def test_workflow_push_and_pull_namespaces_match(self):
        workflow = (pathlib.Path(__file__).resolve().parents[1] / '.github/workflows/build-push.yml').read_text()
        self.assertIn('IMAGE="${HARBOR_URL}/' + REPOSITORY + '"', workflow)
        self.assertNotIn('${HARBOR_URL}/portfolio/nn-portfolio', workflow)
        self.assertIn('org.opencontainers.image.revision=${GITHUB_SHA}', workflow)
        self.assertIn('python3 ci/portfolio_delivery.py', workflow)
        self.assertNotIn("|| echo 'manifest unchanged'", workflow)
        self.assertNotIn('${IMAGE}:latest', workflow)


if __name__ == '__main__':
    unittest.main()
