# Agent Reasoning & Execution Flow (by Releases)

This document visualizes and describes the internal reasoning steps, execution pipeline, and tool routing mechanisms of the Maritime R&D Assistant, mapped across the three product release stages.

---

## 🌊 Execution Pipeline Diagram

The flowchart below illustrates how a user's problem is parsed, routed to candidate generators in parallel, evaluated, and explained. The steps are color-coded by release:
*   **Light Blue (Solid)**: Release 1 (MVP Core)
*   **Light Red (Dashed)**: Release 2 (Interactive Loop)
*   **Light Green (Dashed)**: Release 3 (Dynamic Routing & Enterprise)

```mermaid
flowchart TD
    A([Start]) --> B[User submits problem]

    subgraph r2 ["Release 2: Interactive Loop"]
        C[Clarification Loop]
        C1[Toggle Goals & Constraints]
        C2[Ambiguity Checker]
        
        C --> C1
        C1 --> C2
    end

    subgraph r1 ["Release 1: MVP Core - Framing & Causal Loop"]
        D[Problem Extractor Agent]
        E[5-Whys Analysis Loop]
        E1[Why Step Agent]
        
        D --> E
        E --> E1
    end

    subgraph r3 ["Release 3: Dynamic Tool Routing"]
        G[Dynamic Tool Registry]
        G1[Patent DB Search]
        G2[Material Spec Lookup]
        
        G --> G1
        G1 --> G2
    end

    subgraph r2_parallel ["Release 2: Parallel Generation"]
        H[Parallel Solver Coordinator]
        H1[5-Whys Solver Agent]
        H2[TRIZ Solver Agent]
        
        H --> H1
        H --> H2
    end

    subgraph r2_eval ["Release 2: Deep Evaluation"]
        I[Deep Evaluation Engine]
        I1[Group Similar Solutions]
        I2[Qualitative Pros/Cons LLM]
        
        I --> I1
        I1 --> I2
    end

    subgraph r1_evaluate ["Release 1: MVP Core - Pareto & Verdict"]
        J[Pareto Evaluation Engine]
        J1[Filter optimality gates]
        J2[Render Explainability Report]
        
        J --> J1
        J1 --> J2
    end

    subgraph r3_export ["Release 3: Enterprise Export"]
        K[Enterprise Export]
        K1[Explain Rejected Alternatives]
        K2[Export to PDF/Excel]
        
        K --> K1
        K1 --> K2
    end

    L([End])

    %% Connections between subgraphs
    B -.-> C
    B --> D
    C2 -.->|Yes| D
    C2 -.->|No| C
    
    E1 -->|Hardcoded RAG Tool| J
    E1 -.-> G
    G2 -.-> H
    
    %% Release 1 (sequential path)
    E1 --> H1
    H1 --> H2
    H2 --> J

    %% Release 2 (parallel path)
    E1 -.-> H
    H1 --> I
    H2 --> I
    I --> J
    
    J2 -.-> K
    J2 --> L
    K2 -.-> L

    %% Styling configurations for visual coding
    classDef mvp fill:#e1f5fe,stroke:#3182ce,stroke-width:2px,color:#2b6cb0
    classDef rel2 fill:#fff5f5,stroke:#dd6b20,stroke-width:2px,stroke-dasharray: 5 5,color:#c05621
    classDef rel3 fill:#f0fff4,stroke:#38a169,stroke-width:2px,stroke-dasharray: 5 5,color:#2f855a
    
    class B,D,E,E1,H1,H2,J,J1,J2 mvp
    class C,C1,C2,H,I,I1,I2 rel2
    class G,G1,G2,K,K1,K2 rel3
```

---

## 🛠️ Step-by-Step Pipeline Breakdown

### 📦 Release 1: MVP Core (Blue Items)
In the initial release, the system operates as a direct execution pipeline focusing on problem framing and causal analysis:
1.  **Problem Framing (Problem Extractor Agent)**: The user submits a problem (e.g. *hull breach*), and the agent extracts key variables, constraints, symptoms, and success metrics.
2.  **Causal Discovery (5-Whys Analysis Loop)**: The agent recursively runs a 5-Whys inquiry chain to isolate the underlying root cause.
3.  **Sequential Candidate Generation**: The agent triggers `5-Whys Solver Agent` and `TRIZ Solver Agent` sequentially.
4.  **Explainability & Pareto Selection**: The best concepts are evaluated via the Pareto engine, the winner is recommended, and the system outputs an explanation detailing *why* it was chosen.

### 🚀 Release 2: Interactive Loop, Parallel Solvers & Deep Evaluation (Red Items)
Release 2 introduces user interaction, parallelization, and a deep evaluation loop:
1.  **Interactive Definition**: Rather than going straight to execution, the agent guides the user to define their goals, focus areas, and what constraints to ignore. If the problem is unclear, it triggers clarification questions.
2.  **Parallel Generation**: Move away from sequential execution in `SequentialAgent` to running candidate research streams concurrently using `ParallelAgent` to minimize overall SSE stream response times.
3.  **Deep Evaluation**: Generated candidates undergo deep evaluation: grouping similar solutions, compiling pros and cons, and scoring candidates before final selection.

### 🌐 Release 3: Dynamic Routing & Enterprise Export (Green Items)
The final tier adds dynamic routing capability and enterprise-grade reporting:
1.  **Dynamic Routing**: The agent analyzes the problem type and dynamically selects from a registry of available tools (e.g. patent databases, chemistry specifications), assigning specific tools to specific candidate agents based on context.
2.  **Enterprise Export**: Along with explaining the chosen concept, the system outputs detailed reports explaining why alternative solutions were rejected and defines concrete next steps for implementation.
