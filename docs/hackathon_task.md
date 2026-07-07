# 🏆 Hackathon Task & Inventive Challenges

This document outlines the core requirements, constraints, resources, and inventive challenges defined for the hackathon project.

---

## 📋 Task Description

Build a system for an R&D department (acting as your client/investor) that:

1. Takes the assigned inventive problem.
2. Reformulates it as a technical contradiction.
3. Generates at least **3 candidate solutions** using **TRIZ** via the contradiction matrix.
4. Generates at least **3 candidate solutions** using a **second method** of your choosing (e.g., *5 Whys Causal Loop Intervention*).
5. Evaluates all candidates against the original problem.
6. Selects one winning solution.
7. Presents the **full reasoning trail**:
   - Original problem
   - Technical contradiction
   - All generated candidates
   - Evaluation metrics & criteria
   - Final choice / winner

> [!IMPORTANT]
> **Inspectable Logic:** Every step must run as a real, inspectable piece of logic, not as a single prompt dressed up to look structured.

---

## 💡 Hints & Tips

- **LLM Tools & Integration:** Use of available LLM tools, including web-search & retrieval, is highly encouraged.
- **Context Building:** Build additional context utilizing available documents (for example, SDG reports and domain-specific manuals).
- **Inventive Challenges:** All seven described problems are meant to help in achieving one or more UN Sustainable Development Goals (SDGs). During the live demo, the team should clearly demonstrate potential solutions and how one of the problems is tackled.

---

## 🌊 Main Problem (SDG 14 Alignment)

### Problem 4: Preventing Oil Spills In Maritime Transport (SDG 14)

- **Description:** Moving crude oil across oceans is only economical at scale, which is why the industry relies on very large tankers carrying enormous volumes in a single hull. When something goes wrong — a collision, grounding, or structural failure — the resulting spill can be catastrophic and extremely difficult to contain, devastating marine ecosystems and coastal economies for decades. Global energy and trade systems remain heavily dependent on this mode of transport.
- **Task:** Propose a way to substantially reduce the risk and severity of oil spills from maritime transport. This is ultimately about keeping the situation as-is transport-wise, but keeping marine life happy and safe. 🐠

---

## 🔄 Other Cross-Problems (Processed by Other Teams)

### Problem 1: Reducing Volume of Electronic Waste (SDG 12)

- **Description:** Every year, people buy more phones, laptops, and electronic devices, and every year more of them are thrown away. Most of these devices are manufactured to be affordable, compact, and quick to produce, which shapes how they're assembled and what materials go into them. Once discarded, only a small fraction of this waste is properly collected and processed, and the rest is shipped informally, buried, or scrapped in ways that release toxic materials into the environment. Valuable materials like rare earths, copper, and gold are being lost or turned into a health hazard instead of recovered.
- **Task:** Propose a way to significantly increase the safe, effective recovery of materials from discarded electronics. And remember, I still want to buy this newest phone every year! 📱

### Problem 2: Treating Rising Volumes of Urban Wastewater (SDG 6)

- **Description:** Cities produce enormous volumes of wastewater daily, and treatment plants must process all of it to keep up with demand from growing populations. Treatment plants vary widely in how thoroughly they can purify water before releasing or reusing it, and many cities, especially fast-growing ones, struggle to treat their full wastewater volume to a consistently safe standard. Inadequately treated water returns to rivers, aquifers, and drinking supplies, spreading disease and damaging ecosystems.
- **Task:** Propose a way to treat significantly more wastewater to a safe standard without the massive cost or time investment of traditional plant expansion (we can treat more, but the quality will drop). And stop taking showers is NOT a solution here. 🚿

### Problem 3: Delivering Electricity to Remote Populations (SDG 7)

- **Description:** Hundreds of millions of people, mostly in rural areas, still lack access to electricity. Centralized power grids deliver stable, high-capacity electricity but are extremely costly and slow to extend across remote, low-density terrain. Alternative approaches like solar panels and battery systems can be deployed quickly almost anywhere, but currently fall short of matching a grid connection's reliability and capacity. Access to electricity underpins healthcare, education, small business, and food storage, impairing community development.
- **Task:** Propose a way to deliver electricity that is both fast to deploy and reliably matches the demand of a growing rural population. And no! Batteries are not a solution. We don’t want to produce even more waste. 🗑️

### Problem 5: Reducing Packaging Pollution (SDG 12)

- **Description:** Packaging exists to protect products from damage during shipping, handling, and storage, which typically means using tough, moisture-resistant materials, often made of multi-layered composites or coatings. Once a product reaches its destination, that packaging becomes waste, and much of it is slow to biodegrade or difficult to recycle cleanly. Packaging waste is one of the most visible and universal forms of waste in daily life, accumulating in landfills and oceans worldwide.
- **Task:** Propose a packaging solution that protects products effectively while disappearing or being reused responsibly after use. And paper bags are no good here, as we all know how reliable they are once you drop a paper bag with your lunch due to ripped handle. 🤯

### Problem 6: Improving Desalination (SDG 6 / 7)

- **Description:** Desalination, which is turning seawater into drinking water, is one of the most promising responses to global water scarcity, particularly in regions with limited freshwater sources. Producing freshwater this way requires significant energy input, and the equipment involved experiences wear from the pressures and temperatures used in the process. Many of the regions most in need of desalinated water also face limited or expensive energy access.
- **Task:** Propose a way to substantially increase freshwater output from desalination without a proportional increase in energy demand or equipment strain. The ultimate question is, how to drink undrinkable water from the ultimate source of water on Earth. 🌊

### Problem 7: Keeping Buildings Hot & Cold (SDG 13 / 11)

- **Description:** Buildings need to stay warm in winter and cool in summer, and heating and cooling together account for a huge share of global energy use and emissions. Most buildings today are constructed with static materials and insulation that are optimized once and can't adapt as seasons change, as the same walls and windows perform the same way in January and July, regardless of what's actually needed at each moment.
- **Task:** Propose a way to help a building maintain comfortable indoor temperatures across both seasons without relying on year-round static materials or heavy energy use. And remember, the AC is not the solution - it produces A LOT of heat. 😉
