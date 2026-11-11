"""Synthetic-only coverage of the scoped CI proof; never request real credentials."""
import importlib.util
import io
import os
from pathlib import Path
import unittest
from unittest.mock import patch
import urllib.error

spec = importlib.util.spec_from_file_location('probe', Path(__file__).with_name('vault-oidc-probe.py'))
probe = importlib.util.module_from_spec(spec); spec.loader.exec_module(probe)


class ProbeTests(unittest.TestCase):
    def run_main(self, replies):
        env = {'ACTIONS_ID_TOKEN_REQUEST_URL':'https://oidc.example?fixture=1', 'ACTIONS_ID_TOKEN_REQUEST_TOKEN':'synthetic', 'VAULT_PROBE_ROLE':'fixture', 'VAULT_PROBE_PATHS_JSON':'["fixture/path"]'}
        with patch.dict(os.environ, env, clear=True), patch.object(probe, 'request', side_effect=replies) as request:
            return probe.main(), request

    def test_https_required(self):
        with patch.dict(os.environ, {'ACTIONS_ID_TOKEN_REQUEST_URL':'http://invalid'}, clear=True), self.assertRaises(RuntimeError):
            probe.main()

    def test_oidc_login_and_lookup_failures(self):
        self.assertNotIn('login_status', self.run_main([(403,None)])[0])
        self.assertEqual(self.run_main([(200,{'value':'synthetic'}),(403,None)])[0]['login_status'],403)
        result, request = self.run_main([(200,{'value':'synthetic'}),(200,{'auth':{'client_token':'synthetic'}}),(403,None),(403,None),(204,None)])
        self.assertFalse(result['verified']); self.assertEqual(result['self_revoke_status'],204)
        self.assertTrue(request.call_args.args[0].endswith('auth/token/revoke-self'))

    def test_probes_emit_names_only_and_revoke(self):
        result, _ = self.run_main([(200,{'value':'synthetic'}),(200,{'auth':{'client_token':'synthetic'}}),(200,{'data':{'ttl':60}}),(200,{'data':{'data':{'name':'not-emitted'}}}),(204,None)])
        self.assertTrue(result['verified']); self.assertEqual(result['probes'][0]['key_names'],['name'])
        self.assertNotIn('not-emitted',str(result))

    def test_http_success_empty_and_errors(self):
        for raw, expected in [(b'{"ok":true}',{'ok':True}),(b'',None)]:
            response=io.BytesIO(raw); response.status=200
            with patch.object(probe.urllib.request,'urlopen',return_value=response):
                self.assertEqual(probe.request('https://fixture.invalid',{}),(200,expected))
        error=urllib.error.HTTPError('https://fixture.invalid',403,'denied',{},None)
        with patch.object(probe.urllib.request,'urlopen',side_effect=error):
            self.assertEqual(probe.request('https://fixture.invalid',{}),(403,None))
