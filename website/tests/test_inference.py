import os, json, subprocess, sys

def test_model_inference(tmp_path):
    project_root = os.path.dirname(os.path.dirname(__file__))
    script = os.path.join(project_root, 'model_inference.py')
    if not os.path.exists(script):
        pytest.skip('inference script missing')

    result = subprocess.run([sys.executable, script], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    data = json.loads(result.stdout.strip())
    assert data["success"], data
    assert "predictions" in data and len(data["predictions"]) > 0
