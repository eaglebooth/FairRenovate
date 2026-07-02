import ast
import sys
import os

def check_contract():
    contract_path = os.path.join(os.path.dirname(__file__), "..", "contracts", "FairRenovate.py")
    if not os.path.exists(contract_path):
        print(f"Error: Contract file not found at {contract_path}")
        sys.exit(1)

    print(f"Reading contract file: {contract_path}")
    with open(contract_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    # Check header
    if len(lines) < 2:
        print("Error: Contract file is too short.")
        sys.exit(1)

    if not lines[0].strip().startswith("# v0.2.16"):
        print("Error: Line 1 must start with version header '# v0.2.16'")
        sys.exit(1)

    if "Depends" not in lines[1]:
        print("Error: Line 2 must define the 'Depends' pinned release dependency hash.")
        sys.exit(1)

    # Check syntax parsing
    content = "".join(lines)
    try:
        tree = ast.parse(content)
    except Exception as e:
        print(f"AST Parse failed: {e}")
        sys.exit(1)

    # Verify AST constraints
    has_strict_eq = False
    has_nondet = False

    for node in ast.walk(tree):
        # Check imports
        if isinstance(node, ast.Import):
            for name in node.names:
                if name.name not in ["typing", "json"]:
                    print(f"Forbidden import: {name.name}")
                    sys.exit(1)
        elif isinstance(node, ast.ImportFrom):
            if node.module != "genlayer":
                print(f"Forbidden import from module: {node.module}")
                sys.exit(1)

        # Check call to strict_eq or nondet
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            if node.func.attr == "strict_eq":
                has_strict_eq = True
            if node.func.value and isinstance(node.func.value, ast.Attribute):
                if node.func.value.attr == "nondet":
                    has_nondet = True

    if has_nondet and not has_strict_eq:
        print("Error: Found nondet web calls but no strict_eq validator comparison.")
        sys.exit(1)

    print("Success: AST and GenLayer constraints verified successfully!")
    sys.exit(0)

if __name__ == "__main__":
    check_contract()
