"""
Core financial calculations for house flipping analysis.
All functions are pure (no side effects) and return dicts for easy JSON serialization.
"""


def calculate_roi(
    purchase_price: float,
    repair_costs: float,
    arv: float,  # After Repair Value
    holding_months: int = 6,
    monthly_holding_cost: float = 0.0,
    selling_costs_pct: float = 0.06,  # agent commissions + transfer taxes
    financing_costs: float = 0.0,
) -> dict:
    """
    Calculates flip ROI, profit, and key ratios.

    selling_costs_pct: typically 6% (3% buyer agent + 3% seller agent + transfer taxes ~0.5%)
    """
    total_investment = purchase_price + repair_costs + financing_costs + (monthly_holding_cost * holding_months)
    selling_costs = arv * selling_costs_pct
    net_proceeds = arv - selling_costs
    profit = net_proceeds - total_investment

    roi_pct = (profit / total_investment * 100) if total_investment > 0 else 0
    # Annualized ROI accounts for how quickly you turn the investment
    total_months = holding_months if holding_months > 0 else 1
    annualized_roi = roi_pct * (12 / total_months)

    # 70% Rule check: max purchase price = ARV * 0.70 - repairs
    rule_70_max_purchase = (arv * 0.70) - repair_costs

    return {
        "purchase_price": purchase_price,
        "repair_costs": repair_costs,
        "holding_costs": monthly_holding_cost * holding_months,
        "financing_costs": financing_costs,
        "total_investment": total_investment,
        "arv": arv,
        "selling_costs": selling_costs,
        "net_proceeds": net_proceeds,
        "profit": profit,
        "roi_pct": round(roi_pct, 2),
        "annualized_roi_pct": round(annualized_roi, 2),
        "rule_70_max_purchase": rule_70_max_purchase,
        "rule_70_compliant": purchase_price <= rule_70_max_purchase,
        "break_even_arv": total_investment + selling_costs,
    }


def estimate_closing_costs(
    purchase_price: float,
    state: str = "general",
    is_buyer: bool = True,
    loan_amount: float = 0.0,
) -> dict:
    """
    Estimates closing costs for buying or selling a property.
    Percentages are typical US averages; actual costs vary by state and lender.
    """
    costs = {}

    if is_buyer:
        # Title insurance (lender policy)
        costs["title_insurance_lender"] = loan_amount * 0.005 if loan_amount > 0 else 0
        # Title insurance (owner policy)
        costs["title_insurance_owner"] = purchase_price * 0.004
        # Escrow/closing fee
        costs["escrow_fee"] = max(800, purchase_price * 0.002)
        # Home inspection
        costs["home_inspection"] = 400
        # Appraisal
        costs["appraisal"] = 550 if loan_amount > 0 else 0
        # Loan origination (if financing)
        costs["loan_origination"] = loan_amount * 0.01 if loan_amount > 0 else 0
        # Recording fees
        costs["recording_fees"] = 150
        # Transfer tax (varies widely — ~0.1% average)
        costs["transfer_tax"] = purchase_price * 0.001
        # Prepaid interest (15 days average)
        daily_rate = (loan_amount * 0.075) / 365 if loan_amount > 0 else 0
        costs["prepaid_interest"] = daily_rate * 15
        # Homeowner's insurance (first year)
        costs["homeowners_insurance"] = max(1200, purchase_price * 0.005)
        # Property tax escrow (2 months)
        annual_tax_estimate = purchase_price * 0.012
        costs["property_tax_escrow"] = (annual_tax_estimate / 12) * 2

        # State-specific adjustments (high-level)
        state_notes = _state_closing_note(state)
    else:
        # Seller closing costs
        # Real estate agent commissions
        costs["agent_commissions"] = purchase_price * 0.06
        # Transfer tax (seller typically pays in most states)
        costs["transfer_tax"] = purchase_price * 0.001
        # Escrow/closing fee
        costs["escrow_fee"] = max(800, purchase_price * 0.002)
        # Title insurance (owner policy, paid by seller in many states)
        costs["title_insurance"] = purchase_price * 0.004
        # Recording fees
        costs["recording_fees"] = 100
        # Home warranty (optional but common in listings)
        costs["home_warranty_optional"] = 500
        # Prorated property taxes
        costs["prorated_taxes_estimate"] = (purchase_price * 0.012) / 2

        state_notes = _state_closing_note(state)

    total = sum(v for v in costs.items() if isinstance(v, (int, float)))
    total = sum(costs.values())
    total_pct = (total / purchase_price * 100) if purchase_price > 0 else 0

    return {
        "role": "buyer" if is_buyer else "seller",
        "purchase_price": purchase_price,
        "loan_amount": loan_amount,
        "state": state,
        "line_items": costs,
        "total_estimated": round(total, 2),
        "total_as_pct_of_price": round(total_pct, 2),
        "state_notes": state_notes,
        "disclaimer": "These are estimates. Actual costs vary by lender, title company, county, and negotiation.",
    }


def _state_closing_note(state: str) -> str:
    state = state.lower().strip()
    high_tax_states = {"ny": "New York", "nj": "New Jersey", "ct": "Connecticut", "il": "Illinois"}
    low_tax_states = {"tx": "Texas", "fl": "Florida", "nv": "Nevada"}

    if state in high_tax_states:
        return f"{high_tax_states[state]} has higher-than-average transfer taxes and fees. Budget an additional 0.5–2% of purchase price."
    elif state in low_tax_states:
        return f"{low_tax_states[state]} generally has below-average closing costs and no state income tax on profits."
    return "Closing costs vary by county. Confirm transfer tax rates with a local title company."


def estimate_repair_costs(scope: dict) -> dict:
    """
    Estimates repair costs from a scope of work dict.
    scope keys: sqft, roof, hvac, kitchen, bathrooms, flooring, paint,
                windows, electrical, plumbing, foundation, landscaping
    """
    sqft = scope.get("sqft", 1500)
    estimates = {}

    if scope.get("roof"):
        estimates["roof_replacement"] = sqft * 4.5  # ~$4.50/sqft average
    if scope.get("hvac"):
        estimates["hvac_replacement"] = 7500
    if scope.get("kitchen"):
        level = scope["kitchen"]  # "light", "mid", "full"
        estimates["kitchen_remodel"] = {"light": 8000, "mid": 20000, "full": 45000}.get(level, 20000)
    if scope.get("bathrooms"):
        count = scope["bathrooms"]
        estimates["bathroom_remodel"] = count * 7500
    if scope.get("flooring"):
        estimates["flooring"] = sqft * 6  # install + materials
    if scope.get("paint"):
        estimates["interior_paint"] = sqft * 2.5
    if scope.get("windows"):
        count = scope.get("window_count", 10)
        estimates["windows"] = count * 600
    if scope.get("electrical"):
        estimates["electrical_update"] = 5000
    if scope.get("plumbing"):
        estimates["plumbing_update"] = 4500
    if scope.get("foundation"):
        estimates["foundation_repair"] = 12000  # ballpark; requires inspection
    if scope.get("landscaping"):
        estimates["landscaping"] = 3500

    # General contractor overhead + contingency (15%)
    subtotal = sum(estimates.values())
    contingency = subtotal * 0.15
    estimates["contingency_15pct"] = contingency

    return {
        "line_items": estimates,
        "subtotal": round(subtotal, 2),
        "total_with_contingency": round(subtotal + contingency, 2),
        "cost_per_sqft": round((subtotal + contingency) / sqft, 2) if sqft > 0 else 0,
        "note": "These are national averages. Get 3 contractor bids before committing. Costs vary significantly by region.",
    }


def analyze_deal_summary(property_data: dict) -> dict:
    """High-level deal scorecard combining all metrics."""
    purchase = property_data.get("purchase_price", 0)
    repairs = property_data.get("repair_costs", 0)
    arv = property_data.get("arv", 0)
    holding_months = property_data.get("holding_months", 6)
    monthly_holding = property_data.get("monthly_holding_cost", 1500)
    loan_amount = property_data.get("loan_amount", 0)

    roi = calculate_roi(
        purchase_price=purchase,
        repair_costs=repairs,
        arv=arv,
        holding_months=holding_months,
        monthly_holding_cost=monthly_holding,
        financing_costs=loan_amount * 0.02,  # estimate 2 points hard money
    )

    buyer_closing = estimate_closing_costs(purchase, is_buyer=True, loan_amount=loan_amount)
    seller_closing = estimate_closing_costs(arv, is_buyer=False)

    score = _deal_score(roi, purchase, arv)

    return {
        "roi_analysis": roi,
        "buyer_closing_costs": buyer_closing["total_estimated"],
        "seller_closing_costs": seller_closing["total_estimated"],
        "deal_score": score,
        "recommendation": _deal_recommendation(score, roi),
    }


def _deal_score(roi: dict, purchase: float, arv: float) -> str:
    if roi["profit"] <= 0:
        return "D — Loss"
    if roi["roi_pct"] >= 20 and roi["rule_70_compliant"]:
        return "A — Excellent"
    if roi["roi_pct"] >= 15 and roi["rule_70_compliant"]:
        return "B — Good"
    if roi["roi_pct"] >= 10:
        return "C — Fair"
    return "D — Marginal"


def _deal_recommendation(score: str, roi: dict) -> str:
    if score.startswith("A"):
        return f"Strong deal. Projected {roi['roi_pct']}% ROI. Passes the 70% rule. Pursue aggressively."
    if score.startswith("B"):
        return f"Solid deal at {roi['roi_pct']}% ROI. Verify ARV with comps before committing."
    if score.startswith("C"):
        return f"Marginal at {roi['roi_pct']}% ROI. Negotiate purchase price down or reduce repair scope."
    return f"Deal not recommended. Projected profit: ${roi['profit']:,.0f}. Renegotiate or pass."
