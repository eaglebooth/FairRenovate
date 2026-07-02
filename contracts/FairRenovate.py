# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import typing
import json

class FairRenovate(gl.Contract):
    project_count: u256
    homeowner: TreeMap[u256, str]
    contractor: TreeMap[u256, str]
    phase_name: TreeMap[u256, str]
    budget: TreeMap[u256, u256]
    status: TreeMap[u256, str]
    proof_url: TreeMap[u256, str]
    score: TreeMap[u256, u256]
    released_payout: TreeMap[u256, u256]
    ai_comment: TreeMap[u256, str]

    def __init__(self):
        self.project_count = u256(0)

    @gl.public.write
    def create_project(self, contractor: str, phase_name: str, budget: u256) -> typing.Any:
        project_id = self.project_count
        
        # Write storage fields
        self.homeowner[project_id] = ctx.sender
        self.contractor[project_id] = contractor
        self.phase_name[project_id] = phase_name
        self.budget[project_id] = budget
        self.status[project_id] = "ACTIVE"
        self.proof_url[project_id] = ""
        self.score[project_id] = u256(0)
        self.released_payout[project_id] = u256(0)
        self.ai_comment[project_id] = ""

        self.project_count = project_id + u256(1)
        return project_id

    @gl.public.write
    def submit_proof(self, project_id: u256, proof_url: str) -> typing.Any:
        # 1. Bounds check
        if project_id >= self.project_count:
            return "PROJECT_NOT_FOUND"

        # 2. Status check
        current_status = self.status[project_id]
        if current_status != "ACTIVE":
            return "PROJECT_NOT_ACTIVE"

        # 3. Write proof and update status
        self.proof_url[project_id] = proof_url
        self.status[project_id] = "PENDING_AUDIT"
        return "PROOF_SUBMITTED"

    @gl.public.write
    def audit_project(self, project_id: u256) -> typing.Any:
        # 1. Bounds check
        if project_id >= self.project_count:
            return "PROJECT_NOT_FOUND"

        # 2. Status check
        current_status = self.status[project_id]
        if current_status != "PENDING_AUDIT":
            return "PROJECT_NOT_PENDING_AUDIT"

        # 3. Read input fields
        url = self.proof_url[project_id]
        phase = self.phase_name[project_id]
        project_budget = self.budget[project_id]

        # 4. Define local nondeterministic consensus function
        def run() -> str:
            content = ""
            if len(url) > 0:
                resp = gl.nondet.web.get(url)
                content = resp.body.decode("utf-8")
            
            # Truncate content to avoid token overflow
            if len(content) > 4000:
                content = content[:4000]

            prompt = f"""
            You are a Professional Supervising Construction Engineer. Your task is to audit the completed renovation phase and grade the quality of work.
            Phase under audit: {phase}
            Renovation Log/Report content: {content}

            Grade the work on a scale of 0 to 100 based on the following criteria:
            - Structural alignment & straightness (e.g. wall plastering, tiling grout alignment).
            - Surface smoothness and coating consistency (e.g. paint layers, wood varnish).
            - Material specifications matching.
            - Cleanliness and completion criteria.

            Deduct score for minor defects, uneven plastering, grout lines misalignment, or evidence of photo manipulation.
            If the work is completely fake, edited, or completely wrong, give a score of 0.

            Respond with ONLY this JSON format:
            {{{{
                "score": <score_as_integer_from_0_to_100>,
                "comment": "<short_explanation_of_defects_and_remarks>"
            }}}}
            Do not include any other markdown, text, or explanations.
            """
            return gl.nondet.exec_prompt(prompt)

        # 5. Execute strict comparison consensus
        result = gl.eq_principle.strict_eq(run)

        # 6. Parse result and update state
        data = json.loads(result)
        assigned_score = u256(int(data["score"]))
        comment = str(data["comment"])

        # Prevent score greater than 100
        if assigned_score > u256(100):
            assigned_score = u256(100)

        # Proportional budget split: payout = budget * score / 100
        payout = project_budget * assigned_score // u256(100)
        
        self.score[project_id] = assigned_score
        self.released_payout[project_id] = payout
        self.ai_comment[project_id] = comment
        self.status[project_id] = "COMPLETED"

        # Construct deterministic return string
        return json.dumps({
            "project_id": int(project_id),
            "score": int(assigned_score),
            "released_payout": int(payout),
            "comment": comment
        }, sort_keys=True, separators=(",", ":"))

    @gl.public.view
    def get_project(self, project_id: u256) -> str:
        if project_id >= self.project_count:
            return ""
        
        return json.dumps({
            "homeowner": self.homeowner[project_id],
            "contractor": self.contractor[project_id],
            "phase_name": self.phase_name[project_id],
            "budget": int(self.budget[project_id]),
            "status": self.status[project_id],
            "proof_url": self.proof_url[project_id],
            "score": int(self.score[project_id]),
            "released_payout": int(self.released_payout[project_id]),
            "comment": self.ai_comment[project_id]
        }, sort_keys=True, separators=(",", ":"))

    @gl.public.view
    def bet_count(self) -> u256:
        # Added alias view for frontend integration compatibility
        return self.project_count
