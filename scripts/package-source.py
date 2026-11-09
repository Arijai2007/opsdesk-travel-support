"""Package redistributable source only; omit secrets, local records and build outputs."""
import os
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root = Path(__file__).resolve().parents[1]
target = root.parent / 'OpsDesk_Source.zip'
excluded = {'node_modules', '.git', '.next', '.opsdesk', 'dist', 'coverage', '__pycache__', 'generated'}
with ZipFile(target, 'w', compression=ZIP_DEFLATED, compresslevel=6) as archive:
    for directory, folders, files in os.walk(root, followlinks=False):
        folders[:] = [f for f in folders if f not in excluded and not (Path(directory) / f).is_symlink()]
        for name in files:
            if (name.startswith('.env') and not name.endswith('.example')) or name.endswith(('.tsbuildinfo', '.log', '.pyc')):
                continue
            path = Path(directory) / name
            if path.is_symlink():
                continue
            archive.write(path, Path('OpsDesk') / path.relative_to(root))
with ZipFile(target) as archive:
    names = archive.namelist()
    assert not any('/node_modules/' in n or '/.opsdesk/' in n or '/.git/' in n for n in names)
    assert not any(Path(n).name.startswith('.env') and not n.endswith('.example') for n in names)
    assert 'OpsDesk/OPSDESK_README.md' in names and 'OpsDesk/package-lock.json' in names
print(f'Packaged {len(names)} source files: {target} ({target.stat().st_size:,} bytes). Local secrets and runtime records excluded.')
