"""Verify a bench token (e.g. minted by the Neon `bench_session()` function) with the bench's own reader.

Usage: TEDTRONICS_BENCH_SECRET=... python graph_validator/tools/check_bench_token.py <token>
"""
import sys

from graph_validator.service.security import read_bench_token

claims = read_bench_token(sys.argv[1])
print(claims if claims else "INVALID or expired")
sys.exit(0 if claims else 1)
