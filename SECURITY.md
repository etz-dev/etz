# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of Etz seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Please Do NOT

- Open a public GitHub issue for security vulnerabilities
- Disclose the vulnerability publicly before it has been addressed

### Please DO

1. **Report via GitHub Security Advisories** (Preferred)
   - Go to the [Security tab](https://github.com/etz-dev/etz/security/advisories)
   - Click "Report a vulnerability"
   - Provide as much information as possible

2. **Report via GitHub Issues** (If Security Advisory is not available)
   - Create a private issue with the label `security`
   - Include detailed information about the vulnerability

### What to Include

When reporting a vulnerability, please include:

- **Description** - What is the vulnerability?
- **Impact** - What can an attacker do?
- **Steps to Reproduce** - How can we reproduce the issue?
- **Affected Versions** - Which versions are affected?
- **Mitigation** - Are there any workarounds?
- **Credit** - How would you like to be credited? (optional)

### Example Report

```
**Description:**
The `etz open` command allows command injection through repository names.

**Impact:**
An attacker could execute arbitrary commands if they can control repository
names in the configuration file.

**Steps to Reproduce:**
1. Create a config with repo name: `repo; rm -rf /`
2. Run `etz open worktree "repo; rm -rf /"`
3. Arbitrary command executes

**Affected Versions:**
All versions up to 1.0.0

**Mitigation:**
Validate and sanitize repository names before using them in shell commands.
```

## Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 7 days
- **Fix Development**: Depends on severity
- **Release**: As soon as possible after fix is ready

## Severity Levels

We classify vulnerabilities using the following severity levels:

### Critical
- Remote code execution
- Privilege escalation
- Data loss

**Response Time**: Immediate (within 24-48 hours)

### High
- Authentication bypass
- Data exposure
- Denial of service

**Response Time**: Within 1 week

### Medium
- Information disclosure
- Minor security issues

**Response Time**: Within 2 weeks

### Low
- Issues with minimal security impact

**Response Time**: Next regular release

## Security Best Practices for Users

### Configuration Security

1. **Protect your config file**
```bash
chmod 600 ~/.etzconfig.yaml
```

2. **Don't commit config files with sensitive data**
```bash
# Add to .gitignore
.etzconfig.yaml
.etz/config.yaml
```

3. **Validate repository paths**
   - Ensure all repository paths in your config are correct
   - Don't use repositories from untrusted sources

### Command Safety

1. **Review commands before execution**
   - Use `--dry-run` flag to preview actions
   - Check what will be executed before confirming

2. **Keep Etz updated**
```bash
npm update -g @etz/cli
```

3. **Use specific versions in production**
```bash
# In package.json
"@etz/cli": "1.0.0"  // not "^1.0.0" or "latest"
```

## Known Limitations

### Local Operations Only
Etz operates on local git repositories and does not:
- Send data to external servers
- Make network requests (except git operations)
- Collect telemetry or analytics

### File System Access
Etz requires:
- Read access to git repositories
- Write access to worktree directory
- Access to configuration files

## Security Updates

Security updates will be:
- Released as patch versions (1.0.x)
- Announced in [GitHub Releases](https://github.com/etz-dev/etz/releases)
- Tagged with `security` label
- Include CHANGELOG entry

## Attribution

We appreciate security researchers who help keep Etz safe. We will:
- Credit you in the CHANGELOG (unless you prefer to remain anonymous)
- Mention you in the release notes
- Thank you publicly (if you agree)

## Questions?

If you have questions about security that aren't covered here:
- Open a public issue with the `question` label
- For sensitive questions, use the reporting methods above

---

Thank you for helping keep Etz and our users safe!
